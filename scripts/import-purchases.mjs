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
const CREATED_BY = '4527ff9c-b820-4ac2-a051-eceffe5c173b'; // Sangeetha V
const BATCH_SIZE = 200;

// Old INT supplier ID → new Supabase UUID
const SUPPLIER_MAP = {
  1: '7450ec70-5b7b-47d0-aa3e-7b55231db663',  // Gaja lakshmi pharma
  2: '69b48374-2709-4ca3-8067-5527927d0409',  // Nandhi Pharma
  3: '37a630bd-0034-4b4c-a7a0-f81c5220b14e',  // RATHNA PHARMA
  4: 'a7fd3ebf-9b41-471b-a1e7-24537755d36c',  // VENUS AGENSY
  5: '14b300ad-788e-4c65-be2d-aee823a5e006',  // SRI AMMAN PHARMA
  6: '59e0b616-855d-41ea-82ee-626f58c13b6e',  // KVB TRADERS
  7: '48bf0f1e-bc33-45e1-8012-604e113e2c2b',  // TAMILNADU PHARMA
  8: '7cfece65-236e-4936-8678-e6f58e032c1f',  // SRI MEDICAL DISTRIBUTOR
  9: '6c1eef9f-1b6c-4ae7-8508-274da746240e',  // RAGAVENDRA MEDICAL AGENCY
  10: 'c87fe766-fbf7-4118-adc1-43db69d74c25', // SHREE AMMAN AGENCIES GODOWN
  11: '0ff80919-6bf7-4b61-830a-675fab5015b7', // SMART MEDICAL AGENCIES
  12: '2fdbfdcd-5005-4a06-abfa-d378e3bb91f8', // SRI VIGNESH MEDICAL AGENCIES
  13: '3312c105-a724-4e93-87c3-d65714409509', // pandi
};

function parsePurchaseSQL(filePath) {
  const sql = readFileSync(filePath, 'utf8');
  const rows = [];

  // Match INSERT VALUES rows: (id, supplier, date, total, tax, discounttype, discount, discount_value, amount, note, user_id, date_of_joining)
  const insertRegex = /\((\d+),\s*(\d+),\s*'([^']*)',\s*([\d.]+),\s*([\d.]+),\s*(\d+),\s*'([^']*)',\s*([\d.]+),\s*([\d.]+),\s*'([^']*)',\s*(\d+),\s*'([^']*)'\)/g;

  let match;
  while ((match = insertRegex.exec(sql)) !== null) {
    rows.push({
      old_id: parseInt(match[1]),
      supplier_int: parseInt(match[2]),
      date: match[3],
      total: parseFloat(match[4]),
      tax: parseFloat(match[5]),
      discounttype: parseInt(match[6]),
      discount: match[7],
      discount_value: parseFloat(match[8]),
      amount: parseFloat(match[9]),
      note: match[10],
      user_id: parseInt(match[11]),
      date_of_joining: match[12],
    });
  }

  return rows;
}

async function main() {
  console.log('=== Step 1: Parsing ds_medicine_purchase.sql ===');
  const purchases = parsePurchaseSQL('docs/data/ds_medicine_purchase.sql');
  console.log(`Parsed ${purchases.length} purchase records`);

  // Validate supplier mapping
  const unmappedSuppliers = new Set();
  for (const p of purchases) {
    if (!SUPPLIER_MAP[p.supplier_int]) unmappedSuppliers.add(p.supplier_int);
  }
  if (unmappedSuppliers.size > 0) {
    console.error('Unmapped supplier IDs:', [...unmappedSuppliers]);
    process.exit(1);
  }

  // Transform to Supabase format
  const supabaseRows = purchases.map(p => ({
    supplier_id: SUPPLIER_MAP[p.supplier_int],
    invoice_no: p.note.trim() || `LEGACY-${p.old_id}`,
    purchase_date: p.date,
    subtotal: p.total,
    discount: 0, // discount already baked into subtotal
    tax: p.tax,
    total: p.amount,
    status: 'received',
    notes: p.discount_value > 0 ? `Legacy discount: ${p.discount_value}` : null,
    branch_id: BRANCH_ID,
    created_by: CREATED_BY,
    created_at: p.date_of_joining + '+05:30', // IST
  }));

  console.log(`\n=== Step 2: Inserting ${supabaseRows.length} purchases into Supabase ===`);

  // old_id → new Supabase UUID mapping
  const purchaseIdMap = {};
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < supabaseRows.length; i += BATCH_SIZE) {
    const batch = supabaseRows.slice(i, i + BATCH_SIZE);
    const oldIdBatch = purchases.slice(i, i + BATCH_SIZE);

    const { data: result, error } = await supabase
      .from('purchases')
      .insert(batch)
      .select('id');

    if (error) {
      console.error(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message);
      errors += batch.length;
    } else {
      // Map old_id → new UUID
      for (let j = 0; j < result.length; j++) {
        purchaseIdMap[oldIdBatch[j].old_id] = result[j].id;
      }
      inserted += result.length;
      process.stdout.write(`\rInserted: ${inserted}/${supabaseRows.length}`);
    }
  }

  console.log(`\n\nPurchases done! Inserted: ${inserted}, Errors: ${errors}`);
  console.log(`Purchase ID mappings: ${Object.keys(purchaseIdMap).length}`);

  // Save the mapping for Phase 2 (batch import)
  writeFileSync(
    'scripts/output/purchase-id-map.json',
    JSON.stringify(purchaseIdMap, null, 2)
  );
  console.log('Saved purchase ID mapping to scripts/output/purchase-id-map.json');
}

main().catch(console.error);
