-- ============================================================
-- Performance Indexes — Pharmacy POS
-- Applied: 2026-03-03 via Supabase MCP
-- Reason: 8 critical indexes missing from initial schema.
--         Verified against live DB via Supabase MCP before adding.
-- ============================================================

-- user_profiles: auth_user_id is queried in EVERY RLS call
-- (get_user_role and get_user_branch both do WHERE auth_user_id = auth.uid())
-- Without this index, every single DB operation does a full table scan here.
CREATE INDEX IF NOT EXISTS user_profiles_auth_user_id_idx
  ON public.user_profiles(auth_user_id);

-- pos_bill_items: bill_id is the primary join key when fetching a bill's line items
CREATE INDEX IF NOT EXISTS pos_bill_items_bill_id_idx
  ON public.pos_bill_items(bill_id);

-- pos_bill_items: stock_batch_id used in stock deduction lookups
CREATE INDEX IF NOT EXISTS pos_bill_items_stock_batch_id_idx
  ON public.pos_bill_items(stock_batch_id);

-- purchase_items: purchase_id used in detail view and cascade delete (15,400 rows)
CREATE INDEX IF NOT EXISTS purchase_items_purchase_id_idx
  ON public.purchase_items(purchase_id);

-- purchase_items: medicine_id used in medicine detail and purchase history queries
CREATE INDEX IF NOT EXISTS purchase_items_medicine_id_idx
  ON public.purchase_items(medicine_id);

-- stock_batches: purchase_id used when deleting a purchase rolls back its stock batches
CREATE INDEX IF NOT EXISTS stock_batches_purchase_id_idx
  ON public.stock_batches(purchase_id);

-- purchases: composite for branch-scoped date-range queries (reports, listing)
CREATE INDEX IF NOT EXISTS purchases_branch_date_idx
  ON public.purchases(branch_id, purchase_date DESC);

-- purchases: supplier_id for supplier filter in purchase list
CREATE INDEX IF NOT EXISTS purchases_supplier_id_idx
  ON public.purchases(supplier_id);
