/**
 * Generate a complete batch import migration SQL file.
 *
 * Approach:
 * 1. Create staging table with all old batch data (inline VALUES)
 * 2. Create purchase mapping (inline VALUES from purchase_id_mapping.sql)
 * 3. Create medicine mapping via name matching (in SQL)
 * 4. INSERT into purchase_items from staging + mappings
 * 5. INSERT into stock_batches from staging + mappings
 * 6. Clean up staging tables
 *
 * Due to size constraints, we split into:
 * - Part A: staging table creation + old batch data load (may need multiple files)
 * - Part B: medicine mapping + import + cleanup
 */

const fs = require('fs');

// Read parsed batch data
const batches = JSON.parse(fs.readFileSync('docs/data/parsed_batches.json', 'utf8'));
console.log('Total batch rows:', batches.length);

// Read medicine ID -> name mapping
const medMap = JSON.parse(fs.readFileSync('docs/data/medicine_id_names.json', 'utf8'));

// Read purchase ID mapping
const purchaseMapping = fs.readFileSync('docs/data/purchase_id_mapping.sql', 'utf8');
const purchaseValuesMatch = purchaseMapping.match(/AS \(VALUES\s*\n([\s\S]*?)\n\),/);
const purchaseEntries = [];
if (purchaseValuesMatch) {
  const lines = purchaseValuesMatch[1].trim().split('\n');
  for (const line of lines) {
    const m = line.match(/\((\d+),\s*'([^']+)'::uuid/);
    if (m) {
      purchaseEntries.push({ oldId: parseInt(m[1]), uuid: m[2] });
    }
  }
}
console.log('Purchase mapping entries:', purchaseEntries.length);

// Filter out test data (medicine_id=0 and purchase_id=0)
const validBatches = batches.filter(b => b.medicine_id !== 0 && b.purchase_id !== 0);
console.log('Valid batch rows (excl test data):', validBatches.length);

// Constants
const BRANCH_ID = '0ee7be87-875f-4f75-9d7c-189a87383879';

// Generate staging data INSERT for old_batch_staging
// Columns: id, name, batch, expiry, pqty, qty, saleprice, purchaseprice,
//          discounttype, discount, discountvalue, taxprice, price, sold,
//          medicine_id, purchase_id, status, date_of_joining
function escSql(s) {
  return s.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

// Split into batch files of ~2000 rows for the staging INSERT
const ROWS_PER_FILE = 2000;
const numFiles = Math.ceil(validBatches.length / ROWS_PER_FILE);

console.log('Generating', numFiles, 'staging data files...');

for (let fileIdx = 0; fileIdx < numFiles; fileIdx++) {
  const start = fileIdx * ROWS_PER_FILE;
  const end = Math.min(start + ROWS_PER_FILE, validBatches.length);
  const chunk = validBatches.slice(start, end);

  const values = chunk.map(b => {
    const name = escSql(b.name);
    const batch = escSql(b.batch);
    // Convert expiry from YYYY-MM to YYYY-MM-01 date
    const expiryDate = b.expiry.length === 7 ? b.expiry + '-01' : b.expiry;
    return `(${b.id},'${name}','${batch}','${expiryDate}','${escSql(b.pqty)}',${b.qty},${b.saleprice},${b.purchaseprice},${b.discounttype},${b.discount},${b.discountvalue},${b.taxprice},${b.price},${b.sold},${b.medicine_id},${b.purchase_id},${b.status},'${b.date_of_joining}')`;
  }).join(',\n');

  let sql;
  if (fileIdx === 0) {
    // First file: create staging table + insert
    sql = `-- Import staging data file ${fileIdx + 1} of ${numFiles}
-- Generated from ds_medicine_batch.sql (${validBatches.length} valid rows)

CREATE TABLE IF NOT EXISTS _staging_old_batches (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  batch TEXT NOT NULL,
  expiry DATE NOT NULL,
  pqty TEXT,
  qty NUMERIC NOT NULL,
  saleprice NUMERIC NOT NULL,
  purchaseprice NUMERIC NOT NULL,
  discounttype INTEGER,
  discount NUMERIC DEFAULT 0,
  discountvalue NUMERIC DEFAULT 0,
  taxprice NUMERIC DEFAULT 0,
  price NUMERIC NOT NULL,
  sold NUMERIC DEFAULT 0,
  medicine_id INTEGER NOT NULL,
  purchase_id INTEGER NOT NULL,
  status INTEGER DEFAULT 1,
  date_of_joining TIMESTAMP NOT NULL
);

TRUNCATE _staging_old_batches;

INSERT INTO _staging_old_batches VALUES
${values};
`;
  } else {
    // Subsequent files: just insert
    sql = `-- Import staging data file ${fileIdx + 1} of ${numFiles}
INSERT INTO _staging_old_batches VALUES
${values};
`;
  }

  fs.writeFileSync(`docs/data/import_staging_${fileIdx}.sql`, sql);
  console.log(`  File ${fileIdx}: ${chunk.length} rows, ${Math.round(sql.length / 1024)}KB`);
}

// Generate purchase mapping staging insert
const purchaseValues = purchaseEntries.map(e => `(${e.oldId},'${e.uuid}'::uuid)`).join(',\n');
const purchaseSql = `-- Purchase ID mapping: old int -> Supabase UUID
CREATE TABLE IF NOT EXISTS _staging_purchase_map (
  old_id INTEGER PRIMARY KEY,
  new_uuid UUID NOT NULL
);
TRUNCATE _staging_purchase_map;

INSERT INTO _staging_purchase_map VALUES
${purchaseValues};
`;
fs.writeFileSync('docs/data/import_purchase_map.sql', purchaseSql);
console.log(`Purchase map: ${purchaseEntries.length} entries, ${Math.round(purchaseSql.length / 1024)}KB`);

// Generate medicine mapping SQL (matches by name)
const medSql = `-- Medicine ID mapping via name matching
-- Two-layer matching: exact match first, then suffix-stripped match

CREATE TABLE IF NOT EXISTS _staging_medicine_map (
  old_id INTEGER PRIMARY KEY,
  new_uuid UUID NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'exact'
);
TRUNCATE _staging_medicine_map;

-- Build medicine mapping from staging batch names
WITH old_meds AS (
  SELECT DISTINCT ON (medicine_id) medicine_id AS old_id, name AS old_name
  FROM _staging_old_batches
  ORDER BY medicine_id, id DESC  -- use latest name for each medicine
),
old_cleaned AS (
  SELECT old_id, old_name,
    UPPER(TRIM(old_name)) AS exact_name,
    UPPER(TRIM(REGEXP_REPLACE(old_name,
      '\\s+(TAB|TABS|TABLET|TABLETS|CAP|CAPS|CAPSULE|CAPSULES|SYP|SYRUP|INJ|INJECTION|DRPS|DROPS)\\s*$',
      '', 'i'))) AS stripped_name
  FROM old_meds
),
sb_cleaned AS (
  SELECT id, name,
    UPPER(TRIM(REGEXP_REPLACE(name, E'\\t.*$', ''))) AS exact_name,
    UPPER(TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(name, E'\\t.*$', ''),
      '\\s+(TAB|TABS|TABLET|TABLETS|CAP|CAPS|CAPSULE|CAPSULES|SYP|SYRUP|INJ|INJECTION|DRPS|DROPS)\\s*$',
      '', 'i'
    ))) AS stripped_name
  FROM medicines
),
exact_match AS (
  SELECT DISTINCT ON (o.old_id) o.old_id, s.id AS new_uuid, 'exact'::text AS match_type
  FROM old_cleaned o
  JOIN sb_cleaned s ON s.exact_name = o.exact_name
  ORDER BY o.old_id, s.id
),
stripped_match AS (
  SELECT DISTINCT ON (o.old_id) o.old_id, s.id AS new_uuid, 'stripped'::text AS match_type
  FROM old_cleaned o
  JOIN sb_cleaned s ON s.stripped_name = o.stripped_name
  WHERE o.old_id NOT IN (SELECT old_id FROM exact_match)
  ORDER BY o.old_id, s.id
)
INSERT INTO _staging_medicine_map (old_id, new_uuid, match_type)
SELECT old_id, new_uuid, match_type FROM exact_match
UNION ALL
SELECT old_id, new_uuid, match_type FROM stripped_match;

-- Report mapping stats
SELECT
  (SELECT COUNT(*) FROM _staging_medicine_map) AS mapped,
  (SELECT COUNT(DISTINCT medicine_id) FROM _staging_old_batches) AS total_unique,
  (SELECT COUNT(*) FROM _staging_medicine_map WHERE match_type = 'exact') AS exact_matches,
  (SELECT COUNT(*) FROM _staging_medicine_map WHERE match_type = 'stripped') AS stripped_matches;
`;
fs.writeFileSync('docs/data/import_medicine_map.sql', medSql);
console.log('Medicine mapping SQL written');

// Generate the final import SQL
const importSql = `-- Final import: staging -> purchase_items + stock_batches
-- Only imports rows where BOTH medicine and purchase mappings exist

-- Step 1: Insert into purchase_items
INSERT INTO purchase_items (
  id, purchase_id, medicine_id, batch_no, expiry_date,
  packing_qty, quantity, total_qty,
  purchase_price, sale_price,
  discount_type, discount_value, tax, price
)
SELECT
  uuid_generate_v4(),
  pm.new_uuid,          -- purchase UUID
  mm.new_uuid,          -- medicine UUID
  sb.batch,             -- batch_no
  sb.expiry,            -- expiry_date
  COALESCE(NULLIF(sb.pqty, ''), '1')::numeric,  -- packing_qty
  sb.qty,               -- quantity (units purchased)
  sb.qty * COALESCE(NULLIF(sb.pqty, ''), '1')::numeric, -- total_qty
  sb.purchaseprice,     -- purchase_price per unit
  sb.saleprice,         -- sale_price per unit
  CASE sb.discounttype WHEN 1 THEN 'percent' WHEN 2 THEN 'flat' ELSE 'percent' END,
  sb.discount,          -- discount_value
  sb.taxprice,          -- tax amount
  sb.price              -- line total (price)
FROM _staging_old_batches sb
JOIN _staging_purchase_map pm ON pm.old_id = sb.purchase_id
JOIN _staging_medicine_map mm ON mm.old_id = sb.medicine_id;

-- Step 2: Insert into stock_batches
INSERT INTO stock_batches (
  id, medicine_id, purchase_id, batch_no, expiry_date,
  purchase_price, sale_price,
  initial_qty, sold_qty, available_qty,
  status, branch_id, created_at
)
SELECT
  uuid_generate_v4(),
  mm.new_uuid,          -- medicine UUID
  pm.new_uuid,          -- purchase UUID
  sb.batch,             -- batch_no
  sb.expiry,            -- expiry_date
  sb.purchaseprice,     -- purchase_price per unit
  sb.saleprice,         -- sale_price per unit
  sb.qty,               -- initial_qty
  sb.sold,              -- sold_qty
  sb.qty - sb.sold,     -- available_qty
  CASE sb.status WHEN 1 THEN 'active' WHEN 0 THEN 'active' ELSE 'inactive' END,
  '${BRANCH_ID}'::uuid,
  sb.date_of_joining    -- created_at
FROM _staging_old_batches sb
JOIN _staging_purchase_map pm ON pm.old_id = sb.purchase_id
JOIN _staging_medicine_map mm ON mm.old_id = sb.medicine_id;

-- Report import stats
SELECT
  'purchase_items' AS table_name, COUNT(*) AS rows_inserted FROM purchase_items
UNION ALL
SELECT
  'stock_batches', COUNT(*) FROM stock_batches;

-- Report any unmapped rows
SELECT 'unmapped_medicines' AS issue, COUNT(*) AS cnt
FROM _staging_old_batches sb
WHERE sb.medicine_id NOT IN (SELECT old_id FROM _staging_medicine_map)
UNION ALL
SELECT 'unmapped_purchases', COUNT(*)
FROM _staging_old_batches sb
WHERE sb.purchase_id NOT IN (SELECT old_id FROM _staging_purchase_map)
UNION ALL
SELECT 'total_staging_rows', COUNT(*)
FROM _staging_old_batches;
`;
fs.writeFileSync('docs/data/import_final.sql', importSql);
console.log('Final import SQL written');

// Cleanup SQL
const cleanupSql = `-- Drop staging tables after successful import
DROP TABLE IF EXISTS _staging_old_batches;
DROP TABLE IF EXISTS _staging_purchase_map;
DROP TABLE IF EXISTS _staging_medicine_map;
DROP TABLE IF EXISTS _staging_old_medicines;
`;
fs.writeFileSync('docs/data/import_cleanup.sql', cleanupSql);
console.log('Cleanup SQL written');

console.log('\n=== Execution order ===');
console.log('1. import_staging_0.sql (create table + first batch)');
for (let i = 1; i < numFiles; i++) {
  console.log(`${i + 1}. import_staging_${i}.sql (additional data)`);
}
console.log(`${numFiles + 1}. import_purchase_map.sql (purchase ID mapping)`);
console.log(`${numFiles + 2}. import_medicine_map.sql (medicine ID mapping via name match)`);
console.log(`${numFiles + 3}. import_final.sql (INSERT into purchase_items + stock_batches)`);
console.log(`${numFiles + 4}. import_cleanup.sql (drop staging tables)`);
