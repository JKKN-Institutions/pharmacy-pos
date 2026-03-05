#!/usr/bin/env node
/**
 * Parse Live Stock CSV → generate batched SQL files for Supabase import.
 * Splits medicines into batches of 400 names each.
 *
 * Usage: node scripts/import-live-stock-v2.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const BRANCH_ID = '0ee7be87-875f-4f75-9d7c-189a87383879';
const MED_BATCH = 400;
const STOCK_BATCH = 400;

function parseCSV(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row && row.length >= 9) {
      rows.push({
        name: row[1]?.trim(),
        batch_no: row[2]?.trim(),
        expiry_raw: row[3]?.trim(),
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
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

function parsePrice(val) {
  if (!val) return 0;
  return parseFloat(val.replace(/[₹,\s]/g, '')) || 0;
}

function parseExpiry(raw) {
  if (!raw) return '2025-12-31';
  const parts = raw.split('-');
  if (parts.length !== 2) return '2025-12-31';
  const month = parseInt(parts[0]);
  const year = parseInt(parts[1]);
  if (!month || !year) return '2025-12-31';
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

function esc(str) {
  return (str || '').replace(/'/g, "''");
}

// ─── Main ──────────────────────────────────────────────────────────

const CSV_PATH = 'C:/Users/Admin/Downloads/Live Stock  Pharmacy Management (1).csv';

console.log('Parsing CSV...');
const rows = parseCSV(CSV_PATH);
console.log(`Parsed ${rows.length} rows`);

const uniqueNames = [...new Set(rows.map(r => r.name))].filter(Boolean).sort();
console.log(`${uniqueNames.length} unique medicine names`);

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Medicines (batched) ─────────────────────────────────────────
let medFileNum = 0;
for (let i = 0; i < uniqueNames.length; i += MED_BATCH) {
  medFileNum++;
  const chunk = uniqueNames.slice(i, i + MED_BATCH);
  const values = chunk.map(n => `  ('${esc(n)}')`).join(',\n');

  const sql = `INSERT INTO medicines (name, unit, status, tax_percent, branch_id)
SELECT name, '1', 'active', 0, '${BRANCH_ID}'::uuid
FROM (VALUES
${values}
) AS csv(name)
WHERE NOT EXISTS (
  SELECT 1 FROM medicines m WHERE m.name = csv.name AND m.branch_id = '${BRANCH_ID}'::uuid
);`;

  writeFileSync(join(OUTPUT_DIR, `01_medicines_${String(medFileNum).padStart(2, '0')}.sql`), sql);
}
console.log(`Medicines: ${medFileNum} SQL files`);

// ─── Stock Batches (batched) ─────────────────────────────────────
let stockFileNum = 0;
for (let i = 0; i < rows.length; i += STOCK_BATCH) {
  stockFileNum++;
  const chunk = rows.slice(i, i + STOCK_BATCH);

  const valueRows = chunk.map(row => {
    const expiry = parseExpiry(row.expiry_raw);
    const status = determineStatus(expiry, row.available_qty);
    return `  ('${esc(row.name)}', '${esc(row.batch_no)}', '${expiry}', ${row.purchase_price}, ${row.sale_price}, ${row.initial_qty}, ${row.sold_qty}, ${row.available_qty}, '${status}')`;
  });

  const sql = `INSERT INTO stock_batches (medicine_id, batch_no, expiry_date, purchase_price, sale_price, initial_qty, sold_qty, available_qty, status, branch_id)
SELECT m.id, v.batch_no, v.expiry_date::date, v.purchase_price, v.sale_price, v.initial_qty, v.sold_qty, v.available_qty, v.status, '${BRANCH_ID}'::uuid
FROM (VALUES
${valueRows.join(',\n')}
) AS v(med_name, batch_no, expiry_date, purchase_price, sale_price, initial_qty, sold_qty, available_qty, status)
JOIN medicines m ON m.name = v.med_name AND m.branch_id = '${BRANCH_ID}'::uuid;`;

  writeFileSync(join(OUTPUT_DIR, `02_batches_${String(stockFileNum).padStart(3, '0')}.sql`), sql);
}
console.log(`Stock batches: ${stockFileNum} SQL files`);
console.log('Done!');
