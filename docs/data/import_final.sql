-- Final import: staging -> purchase_items + stock_batches
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
  '0ee7be87-875f-4f75-9d7c-189a87383879'::uuid,
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
