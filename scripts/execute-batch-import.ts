/**
 * Executes the batch import migration by:
 * 1. Reading the generated migration SQL
 * 2. Splitting it into chunks
 * 3. Executing each chunk via the exec_sql() Postgres RPC function
 *
 * Prerequisites:
 *   - _staging_batches table must exist (created via MCP execute_sql)
 *   - exec_sql() function must exist (created via MCP execute_sql)
 *
 * Usage: bun run scripts/execute-batch-import.ts
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const MIGRATION_PATH = join(import.meta.dirname!, '..', 'docs', 'data', 'import_batches_migration.sql')

// Load env
const envPath = join(import.meta.dirname!, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env: Record<string, string> = {}
for (const line of envContent.split('\n')) {
  const eqIdx = line.indexOf('=')
  if (eqIdx > 0) {
    const key = line.substring(0, eqIdx).trim()
    const val = line.substring(eqIdx + 1).trim()
    if (key && val) env[key] = val
  }
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

async function executeSql(sql: string, label: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: sql })
    })

    if (res.ok) {
      console.log(`  OK: ${label}`)
      return true
    }

    const errText = await res.text()
    console.error(`  FAIL [${res.status}]: ${label}`)
    console.error(`  ${errText.substring(0, 500)}`)
    return false
  } catch (e: unknown) {
    console.error(`  ERROR: ${label} — ${e instanceof Error ? e.message : String(e)}`)
    return false
  }
}

function parseChunks(content: string): { label: string; sql: string }[] {
  const chunks: { label: string; sql: string }[] = []
  const lines = content.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Look for chunk markers
    if (line.startsWith('-- Chunk ')) {
      const label = line
      // Next line should be INSERT INTO _staging_batches ...
      i++
      const insertLines: string[] = []

      // Collect lines until we hit a line ending with ';'
      while (i < lines.length) {
        const l = lines[i]
        if (l.trim() === '') {
          i++
          break
        }
        insertLines.push(l)
        if (l.trimEnd().endsWith(';')) {
          i++
          break
        }
        i++
      }

      if (insertLines.length > 0) {
        chunks.push({ label, sql: insertLines.join('\n') })
      }
    } else {
      i++
    }
  }

  return chunks
}

async function main() {
  console.log('Reading migration file...')
  const content = readFileSync(MIGRATION_PATH, 'utf-8')

  // Parse INSERT chunks
  const chunks = parseChunks(content)
  console.log(`Found ${chunks.length} INSERT chunks`)

  // First, truncate staging table (in case of re-run)
  console.log('\nStep 0: Truncating staging table...')
  await executeSql('TRUNCATE _staging_batches;', 'TRUNCATE')

  // Execute each chunk
  console.log(`\nStep 2: Inserting ${chunks.length} chunks into staging...`)
  let totalRows = 0
  for (let i = 0; i < chunks.length; i++) {
    const { label, sql } = chunks[i]
    const rowCount = (sql.match(/\n  \(/g) || []).length
    totalRows += rowCount

    const ok = await executeSql(sql, `${label} (~${rowCount} rows, total: ${totalRows})`)
    if (!ok) {
      console.error(`\nStopped at chunk ${i + 1}/${chunks.length}`)
      console.error('Fix the issue and re-run the script.')
      process.exit(1)
    }
  }

  // Verify staging count
  console.log('\nVerifying staging data...')
  const countRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: 'SELECT count(*) as cnt FROM _staging_batches' })
  })
  if (countRes.ok) {
    const data = await countRes.json()
    console.log(`  Staging table rows: ${JSON.stringify(data)}`)
  }

  // Extract and execute Steps 3-9
  const step3Idx = content.indexOf('-- Step 3:')
  const commitIdx = content.lastIndexOf('COMMIT;')

  if (step3Idx < 0 || commitIdx < 0) {
    console.error('Could not find Steps 3-9 in migration file!')
    process.exit(1)
  }

  // Split the final steps into individual steps
  const finalContent = content.substring(step3Idx, commitIdx)

  // Step 3: Create medicine mapping
  const step3End = finalContent.indexOf('-- Step 4:')
  const step3SQL = finalContent.substring(0, step3End).trim()

  console.log('\nStep 3: Creating medicine ID mapping...')
  const ok3 = await executeSql(step3SQL, 'Medicine mapping')
  if (!ok3) { console.error('Step 3 failed!'); process.exit(1) }

  // Step 4: Create purchase mapping
  const step4Start = finalContent.indexOf('-- Step 4:')
  const step5Start = finalContent.indexOf('-- Step 5')
  const step4SQL = finalContent.substring(step4Start, step5Start).trim()

  console.log('\nStep 4: Creating purchase ID mapping...')
  const ok4 = await executeSql(step4SQL, 'Purchase mapping')
  if (!ok4) { console.error('Step 4 failed!'); process.exit(1) }

  // Step 5: Validation
  const step6Start = finalContent.indexOf('-- Step 6:')
  const step5SQL = finalContent.substring(step5Start, step6Start).trim()

  console.log('\nStep 5: Running validation...')
  const ok5 = await executeSql(step5SQL, 'Validation')
  if (!ok5) { console.error('Step 5 failed (non-fatal, continuing)') }

  // Step 6: Insert into purchase_items
  const step7Start = finalContent.indexOf('-- Step 7:')
  const step6SQL = finalContent.substring(step6Start, step7Start).trim()

  console.log('\nStep 6: Inserting into purchase_items...')
  const ok6 = await executeSql(step6SQL, 'purchase_items INSERT')
  if (!ok6) { console.error('Step 6 failed!'); process.exit(1) }

  // Step 7: Insert into stock_batches
  const step8Start = finalContent.indexOf('-- Step 8:')
  const step7SQL = finalContent.substring(step7Start, step8Start).trim()

  console.log('\nStep 7: Inserting into stock_batches...')
  const ok7 = await executeSql(step7SQL, 'stock_batches INSERT')
  if (!ok7) { console.error('Step 7 failed!'); process.exit(1) }

  // Step 8: Report
  const step9Start = finalContent.indexOf('-- Step 9:')
  const step8SQL = finalContent.substring(step8Start, step9Start).trim()

  console.log('\nStep 8: Reporting results...')
  await executeSql(step8SQL, 'Report')

  // Step 9: Cleanup
  const step9SQL = finalContent.substring(step9Start).trim()

  console.log('\nStep 9: Cleaning up staging tables...')
  await executeSql(step9SQL, 'Cleanup')

  console.log('\n========================================')
  console.log('  BATCH IMPORT COMPLETE!')
  console.log('========================================')
}

main().catch(e => {
  console.error('Unhandled error:', e)
  process.exit(1)
})
