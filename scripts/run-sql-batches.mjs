#!/usr/bin/env node
/**
 * Execute all stock batch SQL files against Supabase using the REST API.
 * Reads SQL files from scripts/output/ and runs them sequentially.
 *
 * Usage: node scripts/run-sql-batches.mjs
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');

const SUPABASE_URL = 'https://jlvfbzgkwyufksmhtfan.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsdmZiemdrd3l1ZmtzbWh0ZmFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwODU0MSwiZXhwIjoyMDg3NDg0NTQxfQ.0YsSyQ4Gdo_IY06eSzbXdPzGiHz7zvHtXVTZGK1uC8s';

async function executeSql(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    // Fallback: use the SQL endpoint directly via pg-meta
    const pgRes = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    return pgRes;
  }
  return res;
}

// Use the Supabase management API SQL endpoint
async function executeSqlDirect(sql) {
  // Use the PostgREST compatible approach: execute raw SQL via the /rest/v1/rpc endpoint
  // Actually, the best way is to use supabase-js
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data, error } = await supabase.rpc('exec_sql', { query: sql }).maybeSingle();
  if (error) {
    // rpc doesn't exist, use raw postgres connection
    // Fall back to direct fetch to the pg endpoint
    throw error;
  }
  return data;
}

// Simplest approach: use supabase-js with raw SQL via .from().select() won't work
// Let's just use fetch to the Supabase SQL API
async function runSQL(sql) {
  // Supabase exposes a SQL endpoint at /pg/query for service role
  // But a simpler approach: use the @supabase/supabase-js with .rpc()
  // Since we can't easily run raw SQL via REST, let's use a different approach

  // Use the Supabase Management API or the pg protocol
  // Actually, the simplest is to use the postgres connection string directly

  // Let's use the pg package instead
  const pg = await import('pg');
  const client = new pg.default.Client({
    connectionString: `postgresql://postgres.jlvfbzgkwyufksmhtfan:${process.env.DB_PASSWORD || 'Sangeetha@2002'}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const result = await client.query(sql);
    return result;
  } finally {
    await client.end();
  }
}

// Even simpler: just use fetch POST to the supabase SQL endpoint
// The Supabase platform has /rest/v1/ but not raw SQL
// Best bet: install pg and connect directly

async function main() {
  // Get all batch SQL files sorted
  const files = readdirSync(OUTPUT_DIR)
    .filter(f => f.startsWith('02_batches_'))
    .sort();

  console.log(`Found ${files.length} stock batch SQL files to execute`);

  // Try pg connection
  let pg;
  try {
    pg = await import('pg');
  } catch {
    console.error('pg not installed. Installing...');
    const { execSync } = await import('child_process');
    execSync('bun add -d pg', { cwd: join(__dirname, '..'), stdio: 'inherit' });
    pg = await import('pg');
  }

  // Supabase connection pooler (transaction mode)
  const connectionString = 'postgresql://postgres.jlvfbzgkwyufksmhtfan:Sangeetha%402002@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';

  for (const file of files) {
    const sql = readFileSync(join(OUTPUT_DIR, file), 'utf-8');
    const client = new pg.default.Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await client.connect();
      const result = await client.query(sql);
      const rowCount = result.rowCount || 0;
      console.log(`✓ ${file} — ${rowCount} rows inserted`);
    } catch (err) {
      console.error(`✗ ${file} — ERROR: ${err.message}`);
    } finally {
      await client.end();
    }
  }

  // Verify total
  const verifyClient = new pg.default.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await verifyClient.connect();
  const { rows } = await verifyClient.query('SELECT count(*) as total FROM stock_batches');
  console.log(`\nTotal stock batches in DB: ${rows[0].total}`);
  await verifyClient.end();
}

main().catch(console.error);
