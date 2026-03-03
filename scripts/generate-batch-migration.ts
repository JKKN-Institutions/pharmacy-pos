/**
 * Parses ds_medicine_batch.sql (MySQL dump) and generates a PostgreSQL migration
 * that imports all rows into purchase_items and stock_batches via:
 *   1. Temp staging table
 *   2. Medicine name mapping (old name → Supabase UUID)
 *   3. Purchase ID mapping (old int → Supabase UUID via date+supplier+subtotal join)
 *   4. INSERT into purchase_items and stock_batches
 *   5. Drop staging table
 *
 * Usage: bun run scripts/generate-batch-migration.ts
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const BATCH_SQL_PATH = join(import.meta.dirname!, '..', 'docs', 'data', 'ds_medicine_batch.sql')
const OUTPUT_PATH = join(import.meta.dirname!, '..', 'docs', 'data', 'import_batches_migration.sql')
const PURCHASE_MAPPING_PATH = join(import.meta.dirname!, '..', 'docs', 'data', 'purchase_id_mapping.sql')

// Branch ID from Supabase
const BRANCH_ID = '0ee7be87-875f-4f75-9d7c-189a87383879'

interface BatchRow {
  id: number
  name: string
  batch: string
  expiry: string      // 'YYYY-MM'
  pqty: string        // packing qty, may have \n
  sqty: number
  qty: number
  saleprice: number
  purchaseprice: number
  totalpurchaseprice: number
  discounttype: number // 1=percent, 2=flat
  discount: number
  discountvalue: number
  tax: string          // JSON string
  taxprice: number
  price: number
  sold: number
  medicine_id: number
  purchase_id: number
  status: number       // 0=active, 1=inactive/expired
  user_id: number
  date_of_joining: string
}

function parseBatchSQL(content: string): BatchRow[] {
  const rows: BatchRow[] = []

  // Match all INSERT VALUE tuples: (id, 'name', 'batch', ...)
  // The data spans lines 59 onward until the semicolon
  // Each row starts with ( and ends with ),  or );
  const insertRegex = /\((\d+),\s*'((?:[^'\\]|\\.|'')*)',\s*'((?:[^'\\]|\\.|'')*)',\s*'((?:[^'\\]|\\.|'')*)',\s*'((?:[^'\\]|\\.|'')*)',\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*(\d+),\s*([\d.]+),\s*([\d.]+),\s*'((?:[^'\\]|\\.|'')*)',\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*'((?:[^'\\]|\\.|'')*)'\)/g

  let match: RegExpExecArray | null
  while ((match = insertRegex.exec(content)) !== null) {
    rows.push({
      id: parseInt(match[1]),
      name: match[2].replace(/''/g, "'").replace(/\\'/g, "'"),
      batch: match[3].replace(/''/g, "'").replace(/\\'/g, "'").replace(/\\n/g, '').trim(),
      expiry: match[4],
      pqty: match[5].replace(/\\n/g, '').replace(/\n/g, '').trim(),
      sqty: parseFloat(match[6]),
      qty: parseFloat(match[7]),
      saleprice: parseFloat(match[8]),
      purchaseprice: parseFloat(match[9]),
      totalpurchaseprice: parseFloat(match[10]),
      discounttype: parseInt(match[11]),
      discount: parseFloat(match[12]),
      discountvalue: parseFloat(match[13]),
      tax: match[14],
      taxprice: parseFloat(match[15]),
      price: parseFloat(match[16]),
      sold: parseFloat(match[17]),
      medicine_id: parseInt(match[18]),
      purchase_id: parseInt(match[19]),
      status: parseInt(match[20]),
      user_id: parseInt(match[21]),
      date_of_joining: match[22],
    })
  }

  return rows
}

function extractPurchaseMappingCTE(content: string): string {
  // Extract the WITH old_purchases(...) AS (VALUES ... ) portion
  const startMarker = 'WITH old_purchases(old_id, supplier_uuid, purchase_date, subtotal) AS (VALUES'
  const endMarker = '),'

  const startIdx = content.indexOf(startMarker)
  if (startIdx === -1) throw new Error('Could not find old_purchases CTE in purchase_id_mapping.sql')

  // Find the closing '),' that ends the VALUES block (before 'purchase_map AS')
  const purchaseMapIdx = content.indexOf('purchase_map AS')
  if (purchaseMapIdx === -1) throw new Error('Could not find purchase_map CTE')

  // Go backwards from purchase_map to find the closing paren+comma
  const valuesEnd = content.lastIndexOf(')', purchaseMapIdx)

  return content.substring(startIdx, valuesEnd + 1)
}

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''").replace(/\\/g, '\\\\')
}

function cleanPqty(pqty: string): number {
  const cleaned = pqty.replace(/[^0-9.]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) || num === 0 ? 1 : num
}

function expiryToDate(expiry: string): string {
  // Convert 'YYYY-MM' to 'YYYY-MM-01'
  if (/^\d{4}-\d{2}$/.test(expiry)) {
    return `${expiry}-01`
  }
  // Handle other formats
  return `${expiry}-01`
}

function batchStatusToText(status: number, expiry: string): string {
  // In old system: status 0 = active, 1 = something else (probably returned/written off)
  // But let's also check expiry
  const expiryDate = new Date(expiryToDate(expiry))
  const now = new Date()

  if (status === 1) return 'written_off'
  if (expiryDate < now) return 'expired'
  return 'active'
}

function main() {
  console.log('Reading ds_medicine_batch.sql...')
  const batchContent = readFileSync(BATCH_SQL_PATH, 'utf-8')

  console.log('Parsing batch rows...')
  const rows = parseBatchSQL(batchContent)
  console.log(`Parsed ${rows.length} batch rows`)

  if (rows.length === 0) {
    console.error('No rows parsed! Check the regex.')
    process.exit(1)
  }

  console.log('Reading purchase_id_mapping.sql...')
  const purchaseMappingContent = readFileSync(PURCHASE_MAPPING_PATH, 'utf-8')

  // Extract the old_purchases VALUES CTE
  const oldPurchasesCTE = extractPurchaseMappingCTE(purchaseMappingContent)

  // Build unique (medicine_id, name) pairs for the medicine mapping
  const medicineMap = new Map<number, string>()
  for (const row of rows) {
    if (!medicineMap.has(row.medicine_id)) {
      medicineMap.set(row.medicine_id, row.name)
    }
  }
  console.log(`Found ${medicineMap.size} unique medicine_id values`)

  // Build unique purchase_ids referenced
  const purchaseIds = new Set<number>()
  for (const row of rows) {
    purchaseIds.add(row.purchase_id)
  }
  console.log(`Found ${purchaseIds.size} unique purchase_id values`)


  // Generate SQL
  const sqlParts: string[] = []

  sqlParts.push(`-- ============================================================`)
  sqlParts.push(`-- Import ds_medicine_batch → purchase_items + stock_batches`)
  sqlParts.push(`-- Generated: ${new Date().toISOString()}`)
  sqlParts.push(`-- Source: ds_medicine_batch.sql (${rows.length} rows)`)
  sqlParts.push(`-- Target: purchase_items, stock_batches`)
  sqlParts.push(`-- Branch: ${BRANCH_ID}`)
  sqlParts.push(`-- ============================================================`)
  sqlParts.push('')
  sqlParts.push('BEGIN;')
  sqlParts.push('')

  // Step 1: Create staging table
  sqlParts.push('-- Step 1: Create staging table')
  sqlParts.push(`CREATE TEMP TABLE _staging_batches (
  old_id          INT NOT NULL,
  name            TEXT NOT NULL,
  batch_no        TEXT NOT NULL,
  expiry          TEXT NOT NULL,
  packing_qty     NUMERIC NOT NULL DEFAULT 1,
  qty             NUMERIC NOT NULL,
  sale_price      NUMERIC NOT NULL,
  purchase_price  NUMERIC NOT NULL,
  discount_type   TEXT NOT NULL DEFAULT 'percent',
  discount_value  NUMERIC NOT NULL DEFAULT 0,
  tax_price       NUMERIC NOT NULL DEFAULT 0,
  price           NUMERIC NOT NULL DEFAULT 0,
  sold            NUMERIC NOT NULL DEFAULT 0,
  old_medicine_id INT NOT NULL,
  old_purchase_id INT NOT NULL,
  old_status      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL
);`)
  sqlParts.push('')

  // Step 2: Insert data in chunks of 500
  sqlParts.push('-- Step 2: Insert batch data into staging (in chunks)')
  const CHUNK_SIZE = 500
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    const chunkNum = Math.floor(i / CHUNK_SIZE) + 1
    const totalChunks = Math.ceil(rows.length / CHUNK_SIZE)

    sqlParts.push(`-- Chunk ${chunkNum}/${totalChunks} (rows ${i + 1} to ${i + chunk.length})`)
    sqlParts.push(`INSERT INTO _staging_batches (old_id, name, batch_no, expiry, packing_qty, qty, sale_price, purchase_price, discount_type, discount_value, tax_price, price, sold, old_medicine_id, old_purchase_id, old_status, created_at) VALUES`)

    const valueLines: string[] = []
    for (const row of chunk) {
      const pqty = cleanPqty(row.pqty)
      const discountType = row.discounttype === 2 ? 'flat' : 'percent'
      const batchNo = row.batch.replace(/'/g, "''")
      const name = row.name.replace(/'/g, "''")

      valueLines.push(`  (${row.id}, '${name}', '${batchNo}', '${row.expiry}', ${pqty}, ${row.qty}, ${row.saleprice}, ${row.purchaseprice}, '${discountType}', ${row.discount}, ${row.taxprice}, ${row.price}, ${row.sold}, ${row.medicine_id}, ${row.purchase_id}, ${row.status}, '${row.date_of_joining}')`)
    }

    sqlParts.push(valueLines.join(',\n') + ';')
    sqlParts.push('')
  }

  // Step 3: Build medicine mapping — old_medicine_id → Supabase UUID
  // Multi-strategy matching: exact → starts-with → stripped suffix
  sqlParts.push('-- Step 3: Create medicine ID mapping')
  sqlParts.push(`-- Map old medicine_id → Supabase medicines.id by matching name`)
  sqlParts.push(`-- Strategy: exact match → starts-with → strip unit suffixes`)
  sqlParts.push(`CREATE TEMP TABLE _medicine_map AS`)
  sqlParts.push(`WITH batch_medicines AS (`)
  sqlParts.push(`  SELECT DISTINCT ON (old_medicine_id) old_medicine_id, UPPER(TRIM(name)) as batch_name`)
  sqlParts.push(`  FROM _staging_batches`)
  sqlParts.push(`  ORDER BY old_medicine_id, old_id DESC`)
  sqlParts.push(`),`)
  sqlParts.push(`supabase_medicines AS (`)
  sqlParts.push(`  SELECT id,`)
  sqlParts.push(`    UPPER(TRIM(CASE`)
  sqlParts.push(`      WHEN name LIKE E'%\\t%' THEN split_part(name, E'\\t', 1)`)
  sqlParts.push(`      ELSE name`)
  sqlParts.push(`    END)) as short_name`)
  sqlParts.push(`  FROM medicines`)
  sqlParts.push(`  WHERE branch_id = '${BRANCH_ID}'`)
  sqlParts.push(`),`)
  sqlParts.push(`-- Strategy 1: Exact case-insensitive match`)
  sqlParts.push(`exact_match AS (`)
  sqlParts.push(`  SELECT bm.old_medicine_id, sm.id as med_uuid, 1 as priority`)
  sqlParts.push(`  FROM batch_medicines bm`)
  sqlParts.push(`  JOIN supabase_medicines sm ON sm.short_name = bm.batch_name`)
  sqlParts.push(`),`)
  sqlParts.push(`-- Strategy 2: Supabase short_name starts with batch_name (batch may lack suffix)`)
  sqlParts.push(`starts_with_match AS (`)
  sqlParts.push(`  SELECT bm.old_medicine_id, sm.id as med_uuid, 2 as priority`)
  sqlParts.push(`  FROM batch_medicines bm`)
  sqlParts.push(`  JOIN supabase_medicines sm ON sm.short_name LIKE bm.batch_name || '%'`)
  sqlParts.push(`  WHERE bm.old_medicine_id NOT IN (SELECT old_medicine_id FROM exact_match)`)
  sqlParts.push(`    AND length(bm.batch_name) >= 4`)
  sqlParts.push(`),`)
  sqlParts.push(`-- Strategy 3: Batch name starts with Supabase short_name (batch has extra suffix like TAB)`)
  sqlParts.push(`reverse_starts_with AS (`)
  sqlParts.push(`  SELECT bm.old_medicine_id, sm.id as med_uuid, 3 as priority`)
  sqlParts.push(`  FROM batch_medicines bm`)
  sqlParts.push(`  JOIN supabase_medicines sm ON bm.batch_name LIKE sm.short_name || '%'`)
  sqlParts.push(`  WHERE bm.old_medicine_id NOT IN (SELECT old_medicine_id FROM exact_match)`)
  sqlParts.push(`    AND bm.old_medicine_id NOT IN (SELECT old_medicine_id FROM starts_with_match)`)
  sqlParts.push(`    AND length(sm.short_name) >= 4`)
  sqlParts.push(`),`)
  sqlParts.push(`-- Strategy 4: Strip common suffixes (TAB, TABLET, CAP, CAPSULE, INJ, SYP etc) and retry`)
  sqlParts.push(`stripped_match AS (`)
  sqlParts.push(`  SELECT bm.old_medicine_id, sm.id as med_uuid, 4 as priority`)
  sqlParts.push(`  FROM batch_medicines bm`)
  sqlParts.push(`  JOIN supabase_medicines sm ON`)
  sqlParts.push(`    TRIM(REGEXP_REPLACE(bm.batch_name, '\\s+(TAB|TABLET|TABLETS|CAP|CAPSULE|CAPS|INJ|INJECTION|SYP|SYRUP|OINT|CREAM|DROP|DROPS|GEL|LOTION|SACHET|POWDER)$', '', 'i'))`)
  sqlParts.push(`    =`)
  sqlParts.push(`    TRIM(REGEXP_REPLACE(sm.short_name, '\\s+(TAB|TABLET|TABLETS|CAP|CAPSULE|CAPS|INJ|INJECTION|SYP|SYRUP|OINT|CREAM|DROP|DROPS|GEL|LOTION|SACHET|POWDER)$', '', 'i'))`)
  sqlParts.push(`  WHERE bm.old_medicine_id NOT IN (SELECT old_medicine_id FROM exact_match)`)
  sqlParts.push(`    AND bm.old_medicine_id NOT IN (SELECT old_medicine_id FROM starts_with_match)`)
  sqlParts.push(`    AND bm.old_medicine_id NOT IN (SELECT old_medicine_id FROM reverse_starts_with)`)
  sqlParts.push(`),`)
  sqlParts.push(`all_matches AS (`)
  sqlParts.push(`  SELECT * FROM exact_match`)
  sqlParts.push(`  UNION ALL SELECT * FROM starts_with_match`)
  sqlParts.push(`  UNION ALL SELECT * FROM reverse_starts_with`)
  sqlParts.push(`  UNION ALL SELECT * FROM stripped_match`)
  sqlParts.push(`)`)
  sqlParts.push(`SELECT DISTINCT ON (old_medicine_id)`)
  sqlParts.push(`  old_medicine_id,`)
  sqlParts.push(`  med_uuid as new_medicine_uuid`)
  sqlParts.push(`FROM all_matches`)
  sqlParts.push(`ORDER BY old_medicine_id, priority, med_uuid;`)
  sqlParts.push('')

  // Step 4: Build purchase mapping using the existing purchase_id_mapping approach
  sqlParts.push('-- Step 4: Create purchase ID mapping')
  sqlParts.push(`CREATE TEMP TABLE _purchase_map AS`)
  sqlParts.push(oldPurchasesCTE + ',')
  sqlParts.push(`purchase_map AS (`)
  sqlParts.push(`  SELECT op.old_id AS old_purchase_id, p.id AS new_purchase_uuid`)
  sqlParts.push(`  FROM old_purchases op`)
  sqlParts.push(`  JOIN purchases p`)
  sqlParts.push(`    ON p.supplier_id = op.supplier_uuid`)
  sqlParts.push(`    AND p.purchase_date = op.purchase_date`)
  sqlParts.push(`    AND p.subtotal = op.subtotal`)
  sqlParts.push(`)`)
  sqlParts.push(`SELECT * FROM purchase_map;`)
  sqlParts.push('')

  // Step 5: Ensure all old_medicine_ids appear in the map (even unmapped ones)
  sqlParts.push('-- Step 5a: Add unmapped medicine_ids with NULL UUID')
  sqlParts.push(`INSERT INTO _medicine_map (old_medicine_id, new_medicine_uuid)`)
  sqlParts.push(`SELECT DISTINCT s.old_medicine_id, NULL`)
  sqlParts.push(`FROM _staging_batches s`)
  sqlParts.push(`WHERE s.old_medicine_id NOT IN (SELECT old_medicine_id FROM _medicine_map);`)
  sqlParts.push('')

  // Validation checks
  sqlParts.push('-- Step 5b: Validation — check for unmapped records')
  sqlParts.push(`DO $$`)
  sqlParts.push(`DECLARE`)
  sqlParts.push(`  unmapped_medicines INT;`)
  sqlParts.push(`  unmapped_purchases INT;`)
  sqlParts.push(`  unmapped_rows INT;`)
  sqlParts.push(`  rec RECORD;`)
  sqlParts.push(`BEGIN`)
  sqlParts.push(`  SELECT count(*) INTO unmapped_medicines`)
  sqlParts.push(`  FROM _medicine_map WHERE new_medicine_uuid IS NULL;`)
  sqlParts.push(``)
  sqlParts.push(`  SELECT count(DISTINCT s.old_purchase_id) INTO unmapped_purchases`)
  sqlParts.push(`  FROM _staging_batches s`)
  sqlParts.push(`  LEFT JOIN _purchase_map pm ON pm.old_purchase_id = s.old_purchase_id`)
  sqlParts.push(`  WHERE pm.new_purchase_uuid IS NULL;`)
  sqlParts.push(``)
  sqlParts.push(`  -- Count total rows that will be skipped`)
  sqlParts.push(`  SELECT count(*) INTO unmapped_rows`)
  sqlParts.push(`  FROM _staging_batches s`)
  sqlParts.push(`  LEFT JOIN _medicine_map mm ON mm.old_medicine_id = s.old_medicine_id`)
  sqlParts.push(`  LEFT JOIN _purchase_map pm ON pm.old_purchase_id = s.old_purchase_id`)
  sqlParts.push(`  WHERE mm.new_medicine_uuid IS NULL OR pm.new_purchase_uuid IS NULL;`)
  sqlParts.push(``)
  sqlParts.push(`  RAISE NOTICE 'Medicine mapping: % of % mapped',`)
  sqlParts.push(`    (SELECT count(*) FROM _medicine_map WHERE new_medicine_uuid IS NOT NULL),`)
  sqlParts.push(`    (SELECT count(*) FROM _medicine_map);`)
  sqlParts.push(`  RAISE NOTICE 'Purchase mapping: % of % mapped',`)
  sqlParts.push(`    (SELECT count(*) FROM _purchase_map),`)
  sqlParts.push(`    (SELECT count(DISTINCT old_purchase_id) FROM _staging_batches);`)
  sqlParts.push(`  RAISE NOTICE 'Rows that will be imported: % of %',`)
  sqlParts.push(`    (SELECT count(*) FROM _staging_batches) - unmapped_rows,`)
  sqlParts.push(`    (SELECT count(*) FROM _staging_batches);`)
  sqlParts.push(`  RAISE NOTICE 'Rows that will be skipped: %', unmapped_rows;`)
  sqlParts.push(``)
  sqlParts.push(`  -- Log specific unmapped medicine names (first 20)`)
  sqlParts.push(`  IF unmapped_medicines > 0 THEN`)
  sqlParts.push(`    RAISE WARNING '% medicine_ids unmapped. Listing first 20:', unmapped_medicines;`)
  sqlParts.push(`    FOR rec IN`)
  sqlParts.push(`      SELECT mm.old_medicine_id, s.name`)
  sqlParts.push(`      FROM _medicine_map mm`)
  sqlParts.push(`      JOIN _staging_batches s ON s.old_medicine_id = mm.old_medicine_id`)
  sqlParts.push(`      WHERE mm.new_medicine_uuid IS NULL`)
  sqlParts.push(`      GROUP BY mm.old_medicine_id, s.name`)
  sqlParts.push(`      ORDER BY mm.old_medicine_id`)
  sqlParts.push(`      LIMIT 20`)
  sqlParts.push(`    LOOP`)
  sqlParts.push(`      RAISE WARNING '  old_medicine_id=%, name=%', rec.old_medicine_id, rec.name;`)
  sqlParts.push(`    END LOOP;`)
  sqlParts.push(`  END IF;`)
  sqlParts.push(``)
  sqlParts.push(`  IF unmapped_purchases > 0 THEN`)
  sqlParts.push(`    RAISE WARNING '% purchase_ids unmapped', unmapped_purchases;`)
  sqlParts.push(`  END IF;`)
  sqlParts.push(`END $$;`)
  sqlParts.push('')

  // Step 6: Insert into purchase_items
  sqlParts.push('-- Step 6: Insert into purchase_items')
  sqlParts.push(`INSERT INTO purchase_items (`)
  sqlParts.push(`  purchase_id, medicine_id, batch_no, expiry_date,`)
  sqlParts.push(`  packing_qty, quantity, total_qty,`)
  sqlParts.push(`  purchase_price, sale_price,`)
  sqlParts.push(`  discount_type, discount_value, tax, price`)
  sqlParts.push(`)`)
  sqlParts.push(`SELECT`)
  sqlParts.push(`  pm.new_purchase_uuid,`)
  sqlParts.push(`  mm.new_medicine_uuid,`)
  sqlParts.push(`  s.batch_no,`)
  sqlParts.push(`  (s.expiry || '-01')::date,`)
  sqlParts.push(`  s.packing_qty,`)
  sqlParts.push(`  CASE WHEN s.packing_qty > 0 THEN s.qty / s.packing_qty ELSE s.qty END,  -- number of packs`)
  sqlParts.push(`  s.qty,                                                                    -- total units`)
  sqlParts.push(`  s.purchase_price,                                                         -- cost per pack`)
  sqlParts.push(`  s.sale_price,                                                             -- MRP per unit`)
  sqlParts.push(`  s.discount_type,`)
  sqlParts.push(`  s.discount_value,`)
  sqlParts.push(`  s.tax_price,`)
  sqlParts.push(`  s.price`)
  sqlParts.push(`FROM _staging_batches s`)
  sqlParts.push(`JOIN _medicine_map mm ON mm.old_medicine_id = s.old_medicine_id`)
  sqlParts.push(`JOIN _purchase_map pm ON pm.old_purchase_id = s.old_purchase_id`)
  sqlParts.push(`WHERE mm.new_medicine_uuid IS NOT NULL`)
  sqlParts.push(`  AND pm.new_purchase_uuid IS NOT NULL;`)
  sqlParts.push('')

  // Step 7: Insert into stock_batches
  sqlParts.push('-- Step 7: Insert into stock_batches')
  sqlParts.push(`INSERT INTO stock_batches (`)
  sqlParts.push(`  medicine_id, purchase_id, batch_no, expiry_date,`)
  sqlParts.push(`  purchase_price, sale_price,`)
  sqlParts.push(`  initial_qty, sold_qty, available_qty,`)
  sqlParts.push(`  status, branch_id, created_at`)
  sqlParts.push(`)`)
  sqlParts.push(`SELECT`)
  sqlParts.push(`  mm.new_medicine_uuid,`)
  sqlParts.push(`  pm.new_purchase_uuid,`)
  sqlParts.push(`  s.batch_no,`)
  sqlParts.push(`  (s.expiry || '-01')::date,`)
  sqlParts.push(`  s.purchase_price,`)
  sqlParts.push(`  s.sale_price,`)
  sqlParts.push(`  s.qty,                                                                    -- initial total units`)
  sqlParts.push(`  s.sold,                                                                   -- units sold`)
  sqlParts.push(`  s.qty - s.sold,                                                           -- available units`)
  sqlParts.push(`  CASE`)
  sqlParts.push(`    WHEN (s.expiry || '-01')::date < CURRENT_DATE THEN 'expired'`)
  sqlParts.push(`    WHEN s.old_status = 0 THEN 'written_off'  -- old system: 0=inactive, 1=active`)
  sqlParts.push(`    ELSE 'active'`)
  sqlParts.push(`  END,`)
  sqlParts.push(`  '${BRANCH_ID}'::uuid,`)
  sqlParts.push(`  s.created_at`)
  sqlParts.push(`FROM _staging_batches s`)
  sqlParts.push(`JOIN _medicine_map mm ON mm.old_medicine_id = s.old_medicine_id`)
  sqlParts.push(`JOIN _purchase_map pm ON pm.old_purchase_id = s.old_purchase_id`)
  sqlParts.push(`WHERE mm.new_medicine_uuid IS NOT NULL`)
  sqlParts.push(`  AND pm.new_purchase_uuid IS NOT NULL;`)
  sqlParts.push('')

  // Step 8: Report results
  sqlParts.push('-- Step 8: Report results')
  sqlParts.push(`DO $$`)
  sqlParts.push(`DECLARE`)
  sqlParts.push(`  pi_count INT;`)
  sqlParts.push(`  sb_count INT;`)
  sqlParts.push(`  skipped INT;`)
  sqlParts.push(`BEGIN`)
  sqlParts.push(`  SELECT count(*) INTO pi_count FROM purchase_items;`)
  sqlParts.push(`  SELECT count(*) INTO sb_count FROM stock_batches;`)
  sqlParts.push(`  SELECT count(*) INTO skipped`)
  sqlParts.push(`  FROM _staging_batches s`)
  sqlParts.push(`  LEFT JOIN _medicine_map mm ON mm.old_medicine_id = s.old_medicine_id`)
  sqlParts.push(`  LEFT JOIN _purchase_map pm ON pm.old_purchase_id = s.old_purchase_id`)
  sqlParts.push(`  WHERE mm.new_medicine_uuid IS NULL OR pm.new_purchase_uuid IS NULL;`)
  sqlParts.push(``)
  sqlParts.push(`  RAISE NOTICE 'Import complete:';`)
  sqlParts.push(`  RAISE NOTICE '  purchase_items: % rows', pi_count;`)
  sqlParts.push(`  RAISE NOTICE '  stock_batches:  % rows', sb_count;`)
  sqlParts.push(`  RAISE NOTICE '  skipped (unmapped): % rows', skipped;`)
  sqlParts.push(`END $$;`)
  sqlParts.push('')

  // Step 9: Cleanup
  sqlParts.push('-- Step 9: Cleanup staging tables')
  sqlParts.push('DROP TABLE IF EXISTS _staging_batches;')
  sqlParts.push('DROP TABLE IF EXISTS _medicine_map;')
  sqlParts.push('DROP TABLE IF EXISTS _purchase_map;')
  sqlParts.push('')
  sqlParts.push('COMMIT;')

  const sql = sqlParts.join('\n')
  writeFileSync(OUTPUT_PATH, sql, 'utf-8')
  console.log(`\nMigration SQL written to: ${OUTPUT_PATH}`)
  console.log(`Total size: ${(sql.length / 1024).toFixed(1)} KB`)
  console.log(`Rows: ${rows.length}`)
  console.log(`Chunks: ${Math.ceil(rows.length / CHUNK_SIZE)}`)
}

main()
