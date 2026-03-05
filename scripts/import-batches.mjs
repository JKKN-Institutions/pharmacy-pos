import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

config({ path: resolve(process.cwd(), 'env.local') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) { console.error('Missing env'); process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);
const BRANCH_ID = '0ee7be87-875f-4f75-9d7c-189a87383879';
const BATCH_SIZE = 200;

// ─── Helpers ────────────────────────────────────────────────────────

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function cleanBatchNo(batch) {
  return batch.replace(/[\n\r]/g, '').trim();
}

function cleanPqty(pqty) {
  const cleaned = pqty.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) || num === 0 ? 1 : num;
}

function expiryToDate(expiry) {
  // 'YYYY-MM' → 'YYYY-MM-01'
  const trimmed = expiry.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed + '-01';
  if (/^\d{4}-\d{1}$/.test(trimmed)) return trimmed.replace(/-(\d)$/, '-0$1') + '-01';
  return '2099-12-01'; // fallback for bad data
}

const PHARMA_SUFFIXES = /\s+(TAB|TABLET|TABLETS|CAP|CAPSULE|CAPSULES|SYP|SYRUP|INJ|INJECTION|DROPS|DROP|CREAM|OINTMENT|GEL|LOTION|SACHET|POWDER|SOLUTION|SPRAY|INHALER|RESPULES|SUSPENSION|STRIP|STRIPS|PASTE)$/i;

function stripSuffix(name) {
  return name.replace(PHARMA_SUFFIXES, '').trim();
}

function normalise(name) {
  return decodeHtmlEntities(name)
    .replace(/[\t\n\r]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

// ─── Step 3: Parse ds_medicine_batch.sql ────────────────────────────

function parseBatchSQL(filePath) {
  const sql = readFileSync(filePath, 'utf8');
  const rows = [];

  // File has 75 separate INSERT blocks. Find ALL of them.
  const valueBlockRegex = /INSERT INTO `ds_medicine_batch`[^V]*VALUES\s*([\s\S]*?);\s*$/gm;
  let blockMatch;
  const allValueBlocks = [];

  while ((blockMatch = valueBlockRegex.exec(sql)) !== null) {
    allValueBlocks.push(blockMatch[1]);
  }

  console.log(`Found ${allValueBlocks.length} INSERT blocks`);

  for (const valuesBlock of allValueBlocks) {
    // Parse individual tuples - handle nested quotes and newlines
    let i = 0;
    const len = valuesBlock.length;

    while (i < len) {
      const tupleStart = valuesBlock.indexOf('(', i);
      if (tupleStart === -1) break;

      // Find matching close paren, handling quoted strings
      let depth = 1;
      let j = tupleStart + 1;
      let inString = false;

      while (j < len && depth > 0) {
        if (inString) {
          if (valuesBlock[j] === "'" && valuesBlock[j - 1] !== '\\') {
            if (j + 1 < len && valuesBlock[j + 1] === "'") {
              j += 2; continue;
            }
            inString = false;
          }
        } else {
          if (valuesBlock[j] === "'") inString = true;
          else if (valuesBlock[j] === '(') depth++;
          else if (valuesBlock[j] === ')') depth--;
        }
        j++;
      }

      const tupleStr = valuesBlock.substring(tupleStart + 1, j - 1);
      i = j;

      // Parse the tuple fields
      const fields = [];
      let fi = 0;
      const tlen = tupleStr.length;

      while (fi < tlen) {
        while (fi < tlen && (tupleStr[fi] === ' ' || tupleStr[fi] === '\n' || tupleStr[fi] === '\r')) fi++;
        if (fi >= tlen) break;

        if (tupleStr[fi] === "'") {
          fi++;
          let val = '';
          while (fi < tlen) {
            if (tupleStr[fi] === "'") {
              if (fi + 1 < tlen && tupleStr[fi + 1] === "'") {
                val += "'";
                fi += 2;
                continue;
              }
              break;
            }
            val += tupleStr[fi];
            fi++;
          }
          fi++;
          fields.push(val);
        } else {
          let val = '';
          while (fi < tlen && tupleStr[fi] !== ',') {
            val += tupleStr[fi];
            fi++;
          }
          fields.push(val.trim());
        }

        while (fi < tlen && (tupleStr[fi] === ',' || tupleStr[fi] === ' ')) fi++;
      }

      if (fields.length >= 22) {
        rows.push({
          old_id: parseInt(fields[0]),
          name: fields[1],
          batch: fields[2],
          expiry: fields[3],
          pqty: fields[4],
          sqty: parseFloat(fields[5]),
          qty: parseFloat(fields[6]),
          saleprice: parseFloat(fields[7]),
          purchaseprice: parseFloat(fields[8]),
          totalpurchaseprice: parseFloat(fields[9]),
          discounttype: parseInt(fields[10]),
          discount: parseFloat(fields[11]),
          discountvalue: parseFloat(fields[12]),
          tax_json: fields[13],
          taxprice: parseFloat(fields[14]),
          price: parseFloat(fields[15]),
          sold: parseFloat(fields[16]),
          medicine_id: parseInt(fields[17]),
          purchase_id: parseInt(fields[18]),
          status: parseInt(fields[19]),
          user_id: parseInt(fields[20]),
          date_of_joining: fields[21],
        });
      }
    }
  }

  return rows;
}

// ─── Step 4: Build medicine name mapping ────────────────────────────

async function buildMedicineMap(batchRows) {
  console.log('\n=== Step 4: Building medicine name → UUID mapping ===');

  // Get all Supabase medicines
  const allMedicines = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('medicines')
      .select('id, name')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) { console.error('Failed to fetch medicines:', error); process.exit(1); }
    allMedicines.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  console.log(`Loaded ${allMedicines.length} Supabase medicines`);

  // Build lookup maps (normalised)
  const exactMap = new Map();     // UPPER(name) → uuid
  const strippedMap = new Map();  // UPPER(name without suffix) → uuid

  for (const m of allMedicines) {
    const norm = normalise(m.name);
    if (!exactMap.has(norm)) exactMap.set(norm, m.id);

    const stripped = stripSuffix(norm);
    if (!strippedMap.has(stripped)) strippedMap.set(stripped, m.id);
  }

  // Collect unique old medicine names (use latest name per old medicine_id)
  const oldMedNames = new Map(); // old_medicine_id → name (latest)
  for (const row of batchRows) {
    if (row.medicine_id === 0) continue;
    // Keep the row with highest old_id (latest purchase) for name
    if (!oldMedNames.has(row.medicine_id) || row.old_id > oldMedNames.get(row.medicine_id).old_id) {
      oldMedNames.set(row.medicine_id, { name: row.name, old_id: row.old_id });
    }
  }
  console.log(`Unique old medicine IDs (excl 0): ${oldMedNames.size}`);

  // 4-layer matching
  const medicineIdMap = new Map(); // old_int_id → supabase UUID
  let exactHits = 0, startsWithHits = 0, reverseHits = 0, strippedHits = 0, misses = 0;
  const unmatchedNames = [];

  for (const [oldId, info] of oldMedNames) {
    const norm = normalise(info.name);

    // Layer 1: Exact match
    if (exactMap.has(norm)) {
      medicineIdMap.set(oldId, exactMap.get(norm));
      exactHits++;
      continue;
    }

    // Layer 2: Supabase name starts with old name
    let found = false;
    for (const [supName, supId] of exactMap) {
      if (supName.startsWith(norm + ' ') || supName.startsWith(norm + '\t')) {
        medicineIdMap.set(oldId, supId);
        startsWithHits++;
        found = true;
        break;
      }
    }
    if (found) continue;

    // Layer 3: Old name starts with Supabase name
    for (const [supName, supId] of exactMap) {
      if (norm.startsWith(supName + ' ') || norm.startsWith(supName + '\t')) {
        medicineIdMap.set(oldId, supId);
        reverseHits++;
        found = true;
        break;
      }
    }
    if (found) continue;

    // Layer 4: Suffix-stripped match
    const normStripped = stripSuffix(norm);
    if (strippedMap.has(normStripped)) {
      medicineIdMap.set(oldId, strippedMap.get(normStripped));
      strippedHits++;
      continue;
    }

    misses++;
    unmatchedNames.push({ oldId, name: info.name });
  }

  console.log(`\nMedicine matching results:`);
  console.log(`  Exact matches:       ${exactHits}`);
  console.log(`  Starts-with matches: ${startsWithHits}`);
  console.log(`  Reverse matches:     ${reverseHits}`);
  console.log(`  Suffix-stripped:     ${strippedHits}`);
  console.log(`  Unmatched:           ${misses}`);
  console.log(`  Match rate:          ${((oldMedNames.size - misses) / oldMedNames.size * 100).toFixed(1)}%`);

  if (unmatchedNames.length > 0) {
    writeFileSync('scripts/output/unmatched-medicines.json', JSON.stringify(unmatchedNames, null, 2));
    console.log(`  Unmatched list saved to scripts/output/unmatched-medicines.json`);
    // Show first 10
    console.log(`  First 10 unmatched:`);
    for (const u of unmatchedNames.slice(0, 10)) {
      console.log(`    [${u.oldId}] ${u.name}`);
    }
  }

  return medicineIdMap;
}

// ─── Step 5 & 6: Insert purchase_items + stock_batches ──────────────

async function importBatches(batchRows, medicineIdMap, purchaseIdMap) {
  const today = new Date().toISOString().split('T')[0];

  // Filter valid rows
  const validRows = [];
  let skippedMedicine = 0, skippedPurchase = 0, skippedTestData = 0;

  for (const row of batchRows) {
    if (row.medicine_id === 0) { skippedTestData++; continue; }

    const medUuid = medicineIdMap.get(row.medicine_id);
    const purUuid = purchaseIdMap[row.purchase_id];

    if (!medUuid) { skippedMedicine++; continue; }
    if (!purUuid) { skippedPurchase++; continue; }

    validRows.push({ ...row, med_uuid: medUuid, pur_uuid: purUuid });
  }

  console.log(`\n=== Step 5 & 6: Inserting purchase_items + stock_batches ===`);
  console.log(`Valid rows: ${validRows.length}`);
  console.log(`Skipped (test data, medicine_id=0): ${skippedTestData}`);
  console.log(`Skipped (unmatched medicine): ${skippedMedicine}`);
  console.log(`Skipped (unmatched purchase): ${skippedPurchase}`);

  let piInserted = 0, sbInserted = 0, piErrors = 0, sbErrors = 0;

  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const batch = validRows.slice(i, i + BATCH_SIZE);

    // Build purchase_items rows
    const purchaseItems = batch.map(r => {
      const packingQty = cleanPqty(r.pqty);
      return {
        purchase_id: r.pur_uuid,
        medicine_id: r.med_uuid,
        batch_no: cleanBatchNo(r.batch),
        expiry_date: expiryToDate(r.expiry),
        packing_qty: packingQty,
        quantity: packingQty > 0 ? Math.round(r.qty / packingQty) : r.qty,
        total_qty: r.qty,
        purchase_price: r.purchaseprice,
        sale_price: r.saleprice,
        discount_type: r.discounttype === 2 ? 'flat' : 'percent',
        discount_value: r.discount,
        tax: r.taxprice,
        price: r.price,
      };
    });

    // Build stock_batches rows
    const stockBatches = batch.map(r => {
      const expiryDate = expiryToDate(r.expiry);
      const isExpired = expiryDate < today;
      let status;
      if (isExpired) status = 'expired';
      else if (r.status === 0) status = 'written_off';
      else status = 'active';

      return {
        medicine_id: r.med_uuid,
        purchase_id: r.pur_uuid,
        batch_no: cleanBatchNo(r.batch),
        expiry_date: expiryDate,
        purchase_price: r.purchaseprice,
        sale_price: r.saleprice,
        initial_qty: r.qty,
        sold_qty: r.sold,
        available_qty: Math.max(r.qty - r.sold, 0),
        status,
        branch_id: BRANCH_ID,
        created_at: r.date_of_joining + '+05:30',
      };
    });

    // Insert both in parallel
    const [piResult, sbResult] = await Promise.all([
      supabase.from('purchase_items').insert(purchaseItems).select('id'),
      supabase.from('stock_batches').insert(stockBatches).select('id'),
    ]);

    if (piResult.error) {
      console.error(`\nPurchase items batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, piResult.error.message);
      piErrors += batch.length;
    } else {
      piInserted += piResult.data.length;
    }

    if (sbResult.error) {
      console.error(`\nStock batches batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, sbResult.error.message);
      sbErrors += batch.length;
    } else {
      sbInserted += sbResult.data.length;
    }

    process.stdout.write(`\rProgress: ${Math.min(i + BATCH_SIZE, validRows.length)}/${validRows.length} | PI: ${piInserted} | SB: ${sbInserted}`);
  }

  console.log(`\n\n=== Results ===`);
  console.log(`Purchase items:  inserted=${piInserted}, errors=${piErrors}`);
  console.log(`Stock batches:   inserted=${sbInserted}, errors=${sbErrors}`);

  return { piInserted, sbInserted };
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('=== Step 3: Parsing ds_medicine_batch.sql ===');
  const batchRows = parseBatchSQL('docs/data/ds_medicine_batch.sql');
  console.log(`Parsed ${batchRows.length} batch records`);

  // Show some stats
  const uniqueMedIds = new Set(batchRows.map(r => r.medicine_id));
  const uniquePurIds = new Set(batchRows.map(r => r.purchase_id));
  console.log(`Unique medicine IDs: ${uniqueMedIds.size}`);
  console.log(`Unique purchase IDs: ${uniquePurIds.size}`);

  // Load purchase ID mapping from Step 2
  const purchaseIdMap = JSON.parse(readFileSync('scripts/output/purchase-id-map.json', 'utf8'));
  console.log(`Loaded ${Object.keys(purchaseIdMap).length} purchase ID mappings`);

  // Build medicine name mapping
  const medicineIdMap = await buildMedicineMap(batchRows);

  // Import
  const { piInserted, sbInserted } = await importBatches(batchRows, medicineIdMap, purchaseIdMap);

  console.log(`\n=== Migration Complete ===`);
  console.log(`Source: ${batchRows.length} batch rows`);
  console.log(`Imported: ${piInserted} purchase_items + ${sbInserted} stock_batches`);
}

main().catch(console.error);
