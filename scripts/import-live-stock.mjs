#!/usr/bin/env node
/**
 * Parse the Live Stock CSV and generate SQL files for Supabase import.
 *
 * Usage: node scripts/import-live-stock.mjs
 *
 * Outputs:
 *   scripts/output/01_new_medicines.sql
 *   scripts/output/02_stock_batches_NNN.sql  (batched, 400 rows each)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const BRANCH_ID = '0ee7be87-875f-4f75-9d7c-189a87383879';
const BATCH_SIZE = 400;

// ─── CSV Parsing ─────────────────────────────────────────────────────────────

function parseCSV(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());

  // Skip header
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row && row.length >= 9) {
      rows.push({
        name: row[1]?.trim(),
        batch_no: row[2]?.trim(),
        expiry_raw: row[3]?.trim(),        // MM-YYYY
        purchase_price: parsePrice(row[4]),
        sale_price: parsePrice(row[5]),
        initial_qty: parseFloat(row[6]) || 0,
        sold_qty: parseFloat(row[7]) || 0,
        available_qty: parseInt(row[8]) || 0,
      });
    }
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parsePrice(val) {
  if (!val) return 0;
  // Strip ₹, commas, spaces
  const cleaned = val.replace(/[₹,\s]/g, '');
  return parseFloat(cleaned) || 0;
}

function parseExpiry(raw) {
  // Format: MM-YYYY → last day of that month
  if (!raw) return '2025-12-31';
  const parts = raw.split('-');
  if (parts.length !== 2) return '2025-12-31';

  const month = parseInt(parts[0]);
  const year = parseInt(parts[1]);
  if (!month || !year) return '2025-12-31';

  // Last day of the month
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function determineStatus(expiryDate, availableQty) {
  const today = new Date('2026-03-05');
  const expiry = new Date(expiryDate);
  if (expiry < today) return 'expired';
  if (availableQty <= 0) return 'exhausted';
  return 'active';
}

function escapeSQL(str) {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

// ─── Main ────────────────────────────────────────────────────────────────────

const CSV_PATH = 'C:/Users/Admin/Downloads/Live Stock  Pharmacy Management (1).csv';

console.log('Reading CSV...');
const rows = parseCSV(CSV_PATH);
console.log(`Parsed ${rows.length} stock batch rows`);

// Get unique medicine names
const uniqueNames = [...new Set(rows.map(r => r.name))].filter(Boolean).sort();
console.log(`Found ${uniqueNames.length} unique medicine names`);

// Read existing medicines from a JSON dump (we'll create this separately)
// For now, generate SQL that handles both cases: existing + new medicines

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Step 1: Generate medicine upsert SQL ───────────────────────────────────
// We'll use INSERT ... ON CONFLICT (name, branch_id) DO NOTHING
// But medicines table doesn't have a unique constraint on (name, branch_id)
// So we'll use a CTE approach: insert only names not already present

let medicineSql = `-- New medicines from Live Stock CSV (names not already in DB)
-- Generated: ${new Date().toISOString()}

INSERT INTO medicines (name, unit, status, tax_percent, branch_id)
SELECT name, '1', 'active', 0, '${BRANCH_ID}'::uuid
FROM (VALUES
`;

const valueLines = uniqueNames.map(name => `  ('${escapeSQL(name)}')`);
medicineSql += valueLines.join(',\n');
medicineSql += `
) AS csv(name)
WHERE NOT EXISTS (
  SELECT 1 FROM medicines m WHERE m.name = csv.name AND m.branch_id = '${BRANCH_ID}'::uuid
);

-- Verify count
SELECT count(*) as total_medicines FROM medicines WHERE branch_id = '${BRANCH_ID}'::uuid;
`;

writeFileSync(join(OUTPUT_DIR, '01_new_medicines.sql'), medicineSql);
console.log(`Written: 01_new_medicines.sql (${uniqueNames.length} unique names)`);

// ─── Step 2: Generate stock_batches INSERT SQL (batched) ─────────────────────
// We need medicine_id lookups by name, so we use a CTE with medicine name join

let batchNum = 0;
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  batchNum++;
  const chunk = rows.slice(i, i + BATCH_SIZE);

  let sql = `-- Stock batches batch ${batchNum} (rows ${i + 1} to ${i + chunk.length})
-- Generated: ${new Date().toISOString()}

INSERT INTO stock_batches (medicine_id, batch_no, expiry_date, purchase_price, sale_price, initial_qty, sold_qty, available_qty, status, branch_id)
SELECT m.id, v.batch_no, v.expiry_date::date, v.purchase_price, v.sale_price, v.initial_qty, v.sold_qty, v.available_qty, v.status, '${BRANCH_ID}'::uuid
FROM (VALUES
`;

  const valueRows = chunk.map(row => {
    const expiry = parseExpiry(row.expiry_raw);
    const status = determineStatus(expiry, row.available_qty);
    return `  ('${escapeSQL(row.name)}', '${escapeSQL(row.batch_no)}', '${expiry}', ${row.purchase_price}, ${row.sale_price}, ${row.initial_qty}, ${row.sold_qty}, ${row.available_qty}, '${status}')`;
  });

  sql += valueRows.join(',\n');
  sql += `
) AS v(med_name, batch_no, expiry_date, purchase_price, sale_price, initial_qty, sold_qty, available_qty, status)
JOIN medicines m ON m.name = v.med_name AND m.branch_id = '${BRANCH_ID}'::uuid;
`;

  const filename = `02_stock_batches_${String(batchNum).padStart(3, '0')}.sql`;
  writeFileSync(join(OUTPUT_DIR, filename), sql);
}

console.log(`Written: ${batchNum} stock batch SQL files (${BATCH_SIZE} rows each)`);
console.log(`\nTotal: ${rows.length} rows across ${batchNum} files`);
console.log('Done! SQL files are in scripts/output/');
