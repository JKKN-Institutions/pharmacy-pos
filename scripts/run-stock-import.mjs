#!/usr/bin/env node
/**
 * Import stock batches from CSV into Supabase using the REST API (PostgREST).
 *
 * 1. Fetches all medicine name→id mappings from Supabase
 * 2. Parses CSV
 * 3. POSTs stock_batches in bulk (500 rows per request)
 *
 * Usage: node scripts/run-stock-import.mjs
 */

import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://jlvfbzgkwyufksmhtfan.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsdmZiemdrd3l1ZmtzbWh0ZmFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwODU0MSwiZXhwIjoyMDg3NDg0NTQxfQ.0YsSyQ4Gdo_IY06eSzbXdPzGiHz7zvHtXVTZGK1uC8s';
const BRANCH_ID = '0ee7be87-875f-4f75-9d7c-189a87383879';
const BATCH_SIZE = 500;

const headers = {
  'Content-Type': 'application/json',
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Prefer': 'return=minimal',
};

// ─── CSV Parsing ─────────────────────────────────────────────────

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

// ─── Supabase REST helpers ───────────────────────────────────────

async function fetchAllMedicines() {
  // Supabase REST API paginates at 1000 rows by default
  // Use Range headers to get all rows
  const allMeds = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/medicines?select=id,name&branch_id=eq.${BRANCH_ID}&order=name&offset=${offset}&limit=${limit}`,
      { headers }
    );
    if (!res.ok) throw new Error(`Failed to fetch medicines: ${res.status} ${await res.text()}`);
    const data = await res.json();
    allMeds.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }

  return allMeds;
}

async function insertBatch(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/stock_batches`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Insert failed: ${res.status} ${errText}`);
  }
  return true;
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log('Step 1: Fetching all medicines from Supabase...');
  const medicines = await fetchAllMedicines();
  console.log(`  → ${medicines.length} medicines fetched`);

  // Build name → id map
  const nameToId = new Map();
  for (const m of medicines) {
    nameToId.set(m.name, m.id);
  }

  console.log('Step 2: Parsing CSV...');
  const CSV_PATH = 'C:/Users/Admin/Downloads/Live Stock  Pharmacy Management (1).csv';
  const csvRows = parseCSV(CSV_PATH);
  console.log(`  → ${csvRows.length} rows parsed`);

  // Map CSV rows to stock_batches objects
  const stockRows = [];
  const unmatchedNames = new Set();

  for (const row of csvRows) {
    const medicineId = nameToId.get(row.name);
    if (!medicineId) {
      unmatchedNames.add(row.name);
      continue;
    }

    const expiryDate = parseExpiry(row.expiry_raw);
    const status = determineStatus(expiryDate, row.available_qty);

    stockRows.push({
      medicine_id: medicineId,
      batch_no: row.batch_no,
      expiry_date: expiryDate,
      purchase_price: row.purchase_price,
      sale_price: row.sale_price,
      initial_qty: row.initial_qty,
      sold_qty: row.sold_qty,
      available_qty: row.available_qty,
      status,
      branch_id: BRANCH_ID,
    });
  }

  if (unmatchedNames.size > 0) {
    console.log(`  ⚠ ${unmatchedNames.size} unmatched medicine names:`);
    for (const n of [...unmatchedNames].slice(0, 10)) console.log(`    - ${n}`);
    if (unmatchedNames.size > 10) console.log(`    ... and ${unmatchedNames.size - 10} more`);
  }

  console.log(`Step 3: Inserting ${stockRows.length} stock batches in chunks of ${BATCH_SIZE}...`);

  let inserted = 0;
  for (let i = 0; i < stockRows.length; i += BATCH_SIZE) {
    const chunk = stockRows.slice(i, i + BATCH_SIZE);
    try {
      await insertBatch(chunk);
      inserted += chunk.length;
      const pct = ((inserted / stockRows.length) * 100).toFixed(1);
      console.log(`  ✓ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} rows (${pct}% done — ${inserted}/${stockRows.length})`);
    } catch (err) {
      console.error(`  ✗ Batch ${Math.floor(i / BATCH_SIZE) + 1} FAILED: ${err.message}`);
      // Try to identify the problematic row
      if (chunk.length > 1) {
        console.log('    Retrying one-by-one...');
        for (let j = 0; j < chunk.length; j++) {
          try {
            await insertBatch([chunk[j]]);
            inserted++;
          } catch (err2) {
            console.error(`    ✗ Row ${i + j + 1} failed: ${err2.message} — medicine: ${chunk[j].medicine_id}, batch: ${chunk[j].batch_no}`);
          }
        }
      }
    }
  }

  console.log(`\n✅ Done! Inserted ${inserted} stock batches out of ${stockRows.length} mapped rows.`);
  if (unmatchedNames.size > 0) {
    console.log(`⚠ Skipped ${csvRows.length - stockRows.length} rows due to unmatched medicine names.`);
  }
}

main().catch(console.error);
