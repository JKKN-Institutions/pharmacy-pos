/**
 * Splits the generated import_batches_migration.sql into individual chunk files
 * for step-by-step execution via Supabase MCP execute_sql.
 *
 * Usage: bun run scripts/split-batch-inserts.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const MIGRATION_PATH = join(import.meta.dirname!, '..', 'docs', 'data', 'import_batches_migration.sql')
const OUTPUT_DIR = join(import.meta.dirname!, '..', 'docs', 'data', 'batch_chunks')

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
}

const content = readFileSync(MIGRATION_PATH, 'utf-8')

// Split by chunk comments: "-- Chunk N/M (rows X to Y)"
const chunkRegex = /-- Chunk (\d+)\/(\d+) \(rows \d+ to \d+\)\n(INSERT INTO _staging_batches .*?);/gs

let match: RegExpExecArray | null
let chunkCount = 0

while ((match = chunkRegex.exec(content)) !== null) {
  chunkCount++
  const chunkNum = match[1]
  const sql = match[3] + ';'
  const filename = `chunk_${chunkNum.padStart(2, '0')}.sql`
  writeFileSync(join(OUTPUT_DIR, filename), sql, 'utf-8')
}

console.log(`Split ${chunkCount} chunks into ${OUTPUT_DIR}`)

// Also extract post-insert steps (Steps 3-9)
const step3Start = content.indexOf('-- Step 3:')
const step9End = content.indexOf('COMMIT;')

if (step3Start > 0 && step9End > 0) {
  const postInsertSQL = content.substring(step3Start, step9End + 'COMMIT;'.length)
  writeFileSync(join(OUTPUT_DIR, 'step_final.sql'), postInsertSQL, 'utf-8')
  console.log('Wrote step_final.sql (Steps 3-9)')
}
