import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load env
config({ path: resolve(process.cwd(), 'env.local') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const BRANCH_ID = '0ee7be87-875f-4f75-9d7c-189a87383879';
const BATCH_SIZE = 200;

async function main() {
  // 1. Get category name → id mapping
  const { data: categories, error: catErr } = await supabase
    .from('medicine_categories')
    .select('id, name');

  if (catErr) { console.error('Failed to fetch categories:', catErr); process.exit(1); }

  // Case-insensitive lookup
  const categoryMap = {};
  for (const cat of categories) {
    categoryMap[cat.name.toLowerCase()] = cat.id;
  }
  console.log(`Loaded ${categories.length} categories`);

  // 2. Read Excel
  const wb = XLSX.readFile('c:/Users/Admin/Downloads/Medicines  Pharmacy Management (1).xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);
  const rows = data.slice(1); // skip header
  console.log(`Read ${rows.length} medicines from Excel`);

  // 3. Transform rows
  const medicines = [];
  const unmatchedCategories = new Set();

  for (const row of rows) {
    const name = (row.__EMPTY || '').toString().trim();
    if (!name) continue;

    const categoryName = (row.__EMPTY_4 || '').toString().trim();
    const categoryId = categoryMap[categoryName.toLowerCase()] || null;

    if (!categoryId && categoryName) {
      unmatchedCategories.add(categoryName);
    }

    const unit = row.__EMPTY_2 != null ? row.__EMPTY_2.toString() : null;
    const unitPacking = row.__EMPTY_3 != null ? row.__EMPTY_3.toString() : null;
    const storeLocation = row.__EMPTY_5 != null ? row.__EMPTY_5.toString() : null;
    const reorderLevel = row.__EMPTY_6 != null ? Number(row.__EMPTY_6) : 0;
    const company = row.__EMPTY_1 ? row.__EMPTY_1.toString().trim() : null;

    // Status: "Normal" → "active", "Minlevel" → "active" (both are active medicines)
    const status = 'active';

    medicines.push({
      name,
      company,
      unit,
      unit_packing: unitPacking,
      category_id: categoryId,
      store_location: storeLocation,
      reorder_level: reorderLevel,
      min_level: 0,
      status,
      branch_id: BRANCH_ID,
      tax_percent: 0,
    });
  }

  if (unmatchedCategories.size > 0) {
    console.warn('Unmatched categories:', [...unmatchedCategories]);
  }

  console.log(`Prepared ${medicines.length} medicines for insert`);

  // 4. Batch insert
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < medicines.length; i += BATCH_SIZE) {
    const batch = medicines.slice(i, i + BATCH_SIZE);
    const { data: result, error } = await supabase
      .from('medicines')
      .insert(batch)
      .select('id');

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message);
      errors += batch.length;
    } else {
      inserted += result.length;
      process.stdout.write(`\rInserted: ${inserted}/${medicines.length}`);
    }
  }

  console.log(`\n\nDone! Inserted: ${inserted}, Errors: ${errors}`);
}

main().catch(console.error);
