-- ============================================================
-- INITIAL SCHEMA — Pharmacy POS
-- Created: 2026-03-03
-- Verified against live DB via Supabase MCP
--
-- This migration documents the baseline schema as it exists in
-- the live database. All objects use IF NOT EXISTS / OR REPLACE
-- so it is safe to re-run against an already-provisioned DB.
-- ============================================================


-- ─── Custom Types ────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'pharmacist', 'cashier');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('cash', 'upi', 'card', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─── Sequences ───────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.pos_bill_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.invoice_seq  START 1;


-- ─── Core / Auth Tables ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.branches (
  id         UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name       TEXT        NOT NULL,
  address    TEXT,
  is_active  BOOLEAN     DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id           UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  auth_user_id UUID REFERENCES auth.users(id),
  name         TEXT        NOT NULL,
  email        TEXT        NOT NULL,
  phone        TEXT,
  role         public.user_role DEFAULT 'cashier',
  branch_id    UUID REFERENCES public.branches(id),
  is_active    BOOLEAN     DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);


-- ─── Medicine / Inventory Tables ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.medicine_categories (
  id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name        TEXT        NOT NULL,
  description TEXT,
  is_active   BOOLEAN     DEFAULT true,
  branch_id   UUID REFERENCES public.branches(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medicines (
  id             UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name           TEXT        NOT NULL,
  aliases        TEXT[]      DEFAULT '{}',
  company        TEXT,
  generic_name   TEXT,
  category_id    UUID REFERENCES public.medicine_categories(id),
  unit           TEXT,
  unit_packing   TEXT,
  medicine_group TEXT,
  store_location TEXT,
  min_level      NUMERIC(10,2) DEFAULT 0,
  reorder_level  NUMERIC(10,2) DEFAULT 0,
  tax_percent    NUMERIC       DEFAULT 0,
  status         TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  branch_id      UUID REFERENCES public.branches(id),
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- Full-text search index on medicine name
CREATE INDEX IF NOT EXISTS medicines_name_idx   ON public.medicines USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS medicines_branch_idx ON public.medicines(branch_id);


-- ─── Suppliers ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.suppliers (
  id             UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name           TEXT NOT NULL,
  contact_person TEXT,
  phone          TEXT,
  email          TEXT,
  address        TEXT,
  city           TEXT,
  pincode        TEXT,
  branch_id      UUID REFERENCES public.branches(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);


-- ─── Purchasing ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.purchases (
  id            UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  supplier_id   UUID REFERENCES public.suppliers(id),
  invoice_no    TEXT        NOT NULL,
  purchase_date DATE        NOT NULL,
  subtotal      NUMERIC(12,2) DEFAULT 0,
  discount      NUMERIC(12,2) DEFAULT 0,
  tax           NUMERIC(12,2) DEFAULT 0,
  total         NUMERIC(12,2) DEFAULT 0,
  status        TEXT DEFAULT 'received',
  notes         TEXT,
  branch_id     UUID REFERENCES public.branches(id),
  created_by    UUID REFERENCES public.user_profiles(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id             UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  purchase_id    UUID REFERENCES public.purchases(id) ON DELETE CASCADE,
  medicine_id    UUID REFERENCES public.medicines(id),
  batch_no       TEXT          NOT NULL,
  expiry_date    DATE          NOT NULL,
  packing_qty    NUMERIC(10,2) DEFAULT 1,
  quantity       NUMERIC(10,2) NOT NULL,
  total_qty      NUMERIC(10,2) NOT NULL,
  purchase_price NUMERIC(10,2) NOT NULL,
  sale_price     NUMERIC(10,2) NOT NULL,
  discount_type  TEXT DEFAULT 'percent' CHECK (discount_type IN ('percent', 'flat')),
  discount_value NUMERIC(10,2) DEFAULT 0,
  tax            NUMERIC(10,2) DEFAULT 0,
  price          NUMERIC(12,2) NOT NULL
);


-- ─── Stock Batches (physical inventory truth table) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.stock_batches (
  id             UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  medicine_id    UUID REFERENCES public.medicines(id),
  purchase_id    UUID REFERENCES public.purchases(id),
  batch_no       TEXT          NOT NULL,
  expiry_date    DATE          NOT NULL,
  purchase_price NUMERIC(10,2) NOT NULL,
  sale_price     NUMERIC(10,2) NOT NULL,
  initial_qty    NUMERIC(10,2) NOT NULL,
  sold_qty       NUMERIC(10,2) DEFAULT 0,
  available_qty  NUMERIC(10,2) NOT NULL,
  status         TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'written_off')),
  branch_id      UUID REFERENCES public.branches(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Critical FEFO index — ORDER BY expiry_date ASC on medicine_id lookup
CREATE INDEX IF NOT EXISTS stock_batches_medicine_idx ON public.stock_batches(medicine_id, expiry_date, status);


-- ─── POS Billing ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pos_bills (
  id             UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  bill_no        TEXT        NOT NULL UNIQUE,
  customer_name  TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  doctor         TEXT,
  payment_method public.payment_method DEFAULT 'cash',
  subtotal       NUMERIC(12,2) DEFAULT 0,
  discount_total NUMERIC(12,2) DEFAULT 0,
  tax_total      NUMERIC(12,2) DEFAULT 0,
  total          NUMERIC(12,2) NOT NULL,
  paid           NUMERIC(12,2) DEFAULT 0,
  due            NUMERIC(12,2) DEFAULT 0,
  note           TEXT,
  bill_date      DATE        NOT NULL,
  status         TEXT DEFAULT 'saved' CHECK (status IN ('saved', 'synced', 'sync_error')),
  synced_at      TIMESTAMPTZ,
  branch_id      UUID REFERENCES public.branches(id),
  created_by     UUID REFERENCES public.user_profiles(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pos_bills_date_idx ON public.pos_bills(bill_date, branch_id);

CREATE TABLE IF NOT EXISTS public.pos_bill_items (
  id             UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  bill_id        UUID REFERENCES public.pos_bills(id) ON DELETE CASCADE,
  medicine_id    UUID REFERENCES public.medicines(id),
  medicine_name  TEXT,
  stock_batch_id UUID REFERENCES public.stock_batches(id),
  batch_no       TEXT          NOT NULL,
  expiry_date    DATE          NOT NULL,
  qty            NUMERIC(10,2) NOT NULL,
  sale_price     NUMERIC(10,2) NOT NULL,
  discount_type  TEXT DEFAULT 'percent' CHECK (discount_type IN ('percent', 'flat')),
  discount_value NUMERIC(10,2) DEFAULT 0,
  tax            NUMERIC(10,2) DEFAULT 0,
  price          NUMERIC(12,2) NOT NULL
);


-- ─── Customers & Invoices (credit/institutional billing) ─────────────────────

CREATE TABLE IF NOT EXISTS public.customers (
  id           UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  first_name   TEXT NOT NULL,
  last_name    TEXT,
  email        TEXT,
  phone        TEXT NOT NULL,
  blood_group  TEXT,
  dob          DATE,
  gender       TEXT CHECK (gender IN ('male', 'female', 'other')),
  address_line1 TEXT,
  address_line2 TEXT,
  city         TEXT,
  pincode      TEXT,
  branch_id    UUID REFERENCES public.branches(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id               UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  invoice_no       TEXT NOT NULL UNIQUE,
  customer_id      UUID REFERENCES public.customers(id),
  payment_method   public.payment_method DEFAULT 'credit',
  payment_status   TEXT DEFAULT 'unpaid'  CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
  invoice_status   TEXT DEFAULT 'draft'   CHECK (invoice_status IN ('draft', 'sent', 'paid')),
  invoice_date     DATE NOT NULL,
  due_date         DATE,
  subtotal         NUMERIC(12,2) DEFAULT 0,
  discount_total   NUMERIC(12,2) DEFAULT 0,
  tax_total        NUMERIC(12,2) DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL,
  paid             NUMERIC(12,2) DEFAULT 0,
  due              NUMERIC(12,2) DEFAULT 0,
  customer_note    TEXT,
  terms_conditions TEXT,
  branch_id        UUID REFERENCES public.branches(id),
  created_by       UUID REFERENCES public.user_profiles(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id               UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  invoice_id       UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_name        TEXT          NOT NULL,
  item_description TEXT,
  qty              NUMERIC(10,2) NOT NULL,
  unit_cost        NUMERIC(10,2) NOT NULL,
  discount_type    TEXT DEFAULT 'percent' CHECK (discount_type IN ('percent', 'flat')),
  discount_value   NUMERIC(10,2) DEFAULT 0,
  tax              NUMERIC(10,2) DEFAULT 0,
  price            NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.customer_payments (
  id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  customer_id UUID REFERENCES public.customers(id),
  invoice_id  UUID REFERENCES public.invoices(id),
  amount      NUMERIC(12,2) NOT NULL,
  method      public.payment_method DEFAULT 'cash',
  date        DATE NOT NULL,
  note        TEXT,
  branch_id   UUID REFERENCES public.branches(id),
  created_by  UUID REFERENCES public.user_profiles(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);


-- ─── Operations / Admin ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.expenses (
  id           UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name         TEXT NOT NULL,
  expense_type TEXT NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,
  method       public.payment_method DEFAULT 'cash',
  date         DATE NOT NULL,
  description  TEXT,
  branch_id    UUID REFERENCES public.branches(id),
  created_by   UUID REFERENCES public.user_profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.salary_records (
  id         UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  staff_name TEXT NOT NULL,
  amount     NUMERIC(12,2) NOT NULL,
  method     public.payment_method DEFAULT 'cash',
  date       DATE NOT NULL,
  note       TEXT,
  branch_id  UUID REFERENCES public.branches(id),
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notices (
  id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  title       TEXT NOT NULL,
  description TEXT,
  start_date  DATE,
  end_date    DATE,
  status      TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  branch_id   UUID REFERENCES public.branches(id),
  created_by  UUID REFERENCES public.user_profiles(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  id                      UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  store_name              TEXT DEFAULT 'My Pharmacy',
  store_legal_name        TEXT,
  email                   TEXT,
  phone                   TEXT,
  logo_url                TEXT,
  address                 TEXT,
  city                    TEXT,
  pincode                 TEXT,
  timezone                TEXT DEFAULT 'Asia/Kolkata',
  date_format             TEXT DEFAULT 'DD/MM/YYYY',
  currency_code           TEXT DEFAULT 'INR',
  currency_symbol         TEXT DEFAULT '₹',
  invoice_prefix          TEXT DEFAULT 'INV-',
  default_customer_note   TEXT,
  default_terms_conditions TEXT,
  branch_id               UUID REFERENCES public.branches(id),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tax_rates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id  UUID NOT NULL REFERENCES public.branches(id),
  name       TEXT NOT NULL,
  rate       NUMERIC CHECK (rate >= 0 AND rate <= 100),
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT tax_rates_name_rate_branch_unique UNIQUE (branch_id, name, rate)
);

CREATE INDEX IF NOT EXISTS tax_rates_branch_id_idx ON public.tax_rates(branch_id);


-- ─── Functions ───────────────────────────────────────────────────────────────

-- Generates POS bill numbers: INV-00001, INV-00002, …
CREATE OR REPLACE FUNCTION public.generate_bill_no()
RETURNS TEXT
LANGUAGE SQL
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT 'INV-' || LPAD(nextval('public.pos_bill_seq')::TEXT, 5, '0');
$$;

-- Generates A4 invoice numbers: INV-00001, INV-00002, …
CREATE OR REPLACE FUNCTION public.generate_invoice_no()
RETURNS TEXT
LANGUAGE SQL
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT 'INV-' || LPAD(nextval('public.invoice_seq')::TEXT, 5, '0');
$$;

-- Atomic stock deduction — prevents race condition in concurrent POS bills.
-- Single UPDATE ensures sold_qty and available_qty are always in sync.
-- The WHERE available_qty >= p_qty guard hard-blocks overselling.
CREATE OR REPLACE FUNCTION public.deduct_batch_stock(p_batch_id UUID, p_qty NUMERIC)
RETURNS VOID
LANGUAGE SQL
SECURITY INVOKER
SET search_path = ''
AS $$
  UPDATE public.stock_batches
  SET    sold_qty      = sold_qty + p_qty,
         available_qty = available_qty - p_qty
  WHERE  id            = p_batch_id
    AND  available_qty >= p_qty;
$$;

-- Returns total revenue per day for the last p_days days (dashboard chart).
CREATE OR REPLACE FUNCTION public.get_daily_revenue(p_days INT DEFAULT 7)
RETURNS TABLE(day DATE, pos_total NUMERIC, invoice_total NUMERIC)
LANGUAGE SQL
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH days AS (
    SELECT generate_series(
      CURRENT_DATE - (p_days - 1) * INTERVAL '1 day',
      CURRENT_DATE,
      INTERVAL '1 day'
    )::DATE AS day
  )
  SELECT
    d.day,
    COALESCE(SUM(pb.total), 0) AS pos_total,
    COALESCE(SUM(inv.total), 0) AS invoice_total
  FROM days d
  LEFT JOIN public.pos_bills pb  ON pb.bill_date     = d.day
  LEFT JOIN public.invoices  inv ON inv.invoice_date  = d.day
  GROUP BY d.day
  ORDER BY d.day;
$$;

-- Returns count of medicines whose total available stock is at or below reorder_level.
CREATE OR REPLACE FUNCTION public.get_low_stock_count()
RETURNS BIGINT
LANGUAGE SQL
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COUNT(DISTINCT m.id)
  FROM public.medicines m
  LEFT JOIN public.stock_batches sb ON sb.medicine_id = m.id AND sb.status = 'active'
  WHERE m.status = 'active'
  GROUP BY m.id, m.reorder_level
  HAVING COALESCE(SUM(sb.available_qty), 0) <= m.reorder_level;
$$;

-- Returns the branch_id for the currently authenticated user.
-- SECURITY DEFINER required so RLS policies can call this safely.
CREATE OR REPLACE FUNCTION public.get_user_branch()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT branch_id FROM public.user_profiles WHERE auth_user_id = auth.uid();
$$;

-- Returns the role (as text) for the currently authenticated user.
-- SECURITY DEFINER required so RLS policies can call this safely.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role::TEXT FROM public.user_profiles WHERE auth_user_id = auth.uid();
$$;


-- ─── Enable RLS on all tables ────────────────────────────────────────────────

ALTER TABLE public.branches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_batches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_bills             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_bill_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_records        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates             ENABLE ROW LEVEL SECURITY;


-- ─── RLS Policies ────────────────────────────────────────────────────────────

-- user_profiles
CREATE POLICY IF NOT EXISTS users_self_read   ON public.user_profiles FOR SELECT USING ((auth_user_id = auth.uid()) OR (get_user_role() = 'admin'));
CREATE POLICY IF NOT EXISTS users_admin_write ON public.user_profiles FOR ALL    USING (get_user_role() = 'admin');

-- medicines
CREATE POLICY IF NOT EXISTS medicines_read   ON public.medicines FOR SELECT USING ((get_user_branch() IS NULL) OR (get_user_branch() = branch_id) OR (branch_id IS NULL));
CREATE POLICY IF NOT EXISTS medicines_write  ON public.medicines FOR INSERT WITH CHECK (get_user_role() = ANY (ARRAY['admin','manager','pharmacist']));
CREATE POLICY IF NOT EXISTS medicines_update ON public.medicines FOR UPDATE USING (get_user_role() = ANY (ARRAY['admin','manager','pharmacist']));
CREATE POLICY IF NOT EXISTS medicines_delete ON public.medicines FOR DELETE USING (get_user_role() = ANY (ARRAY['admin','manager']));

-- medicine_categories
CREATE POLICY IF NOT EXISTS medicine_categories_read  ON public.medicine_categories FOR SELECT USING ((get_user_branch() IS NULL) OR (get_user_branch() = branch_id) OR (branch_id IS NULL));
CREATE POLICY IF NOT EXISTS medicine_categories_write ON public.medicine_categories FOR ALL    USING (get_user_role() = ANY (ARRAY['admin','manager','pharmacist']));

-- suppliers
CREATE POLICY IF NOT EXISTS suppliers_read  ON public.suppliers FOR SELECT USING ((get_user_branch() IS NULL) OR (get_user_branch() = branch_id) OR (branch_id IS NULL));
CREATE POLICY IF NOT EXISTS suppliers_write ON public.suppliers FOR ALL    USING (get_user_role() = ANY (ARRAY['admin','manager','pharmacist']));

-- purchases
CREATE POLICY IF NOT EXISTS purchases_all ON public.purchases FOR ALL USING (((get_user_branch() IS NULL) OR (get_user_branch() = branch_id)) AND (get_user_role() = ANY (ARRAY['admin','manager','pharmacist'])));

-- purchase_items
CREATE POLICY IF NOT EXISTS purchase_items_all ON public.purchase_items FOR ALL USING ((EXISTS (SELECT 1 FROM public.purchases WHERE purchases.id = purchase_items.purchase_id AND ((get_user_branch() IS NULL) OR (get_user_branch() = purchases.branch_id)))) AND (get_user_role() = ANY (ARRAY['admin','manager','pharmacist'])));

-- stock_batches
CREATE POLICY IF NOT EXISTS stock_read   ON public.stock_batches FOR SELECT USING ((get_user_branch() IS NULL) OR (get_user_branch() = branch_id) OR (branch_id IS NULL));
CREATE POLICY IF NOT EXISTS stock_write  ON public.stock_batches FOR INSERT WITH CHECK (get_user_role() = ANY (ARRAY['admin','manager','pharmacist']));
CREATE POLICY IF NOT EXISTS stock_update ON public.stock_batches FOR UPDATE USING (get_user_role() = ANY (ARRAY['admin','manager','pharmacist']));
CREATE POLICY IF NOT EXISTS stock_delete ON public.stock_batches FOR DELETE USING (get_user_role() = ANY (ARRAY['admin','manager']));

-- pos_bills
CREATE POLICY IF NOT EXISTS pos_bills_select ON public.pos_bills FOR SELECT USING ((get_user_branch() IS NULL) OR (get_user_branch() = branch_id));
CREATE POLICY IF NOT EXISTS pos_bills_insert ON public.pos_bills FOR INSERT WITH CHECK ((get_user_branch() IS NULL) OR (get_user_branch() = branch_id));
CREATE POLICY IF NOT EXISTS pos_bills_delete ON public.pos_bills FOR DELETE USING (get_user_role() = ANY (ARRAY['admin','manager']));

-- pos_bill_items
CREATE POLICY IF NOT EXISTS pos_bill_items_all ON public.pos_bill_items FOR ALL USING (EXISTS (SELECT 1 FROM public.pos_bills WHERE pos_bills.id = pos_bill_items.bill_id AND ((get_user_branch() IS NULL) OR (get_user_branch() = pos_bills.branch_id))));

-- invoices
CREATE POLICY IF NOT EXISTS invoices_all ON public.invoices FOR ALL USING (((get_user_branch() IS NULL) OR (get_user_branch() = branch_id)) AND (get_user_role() = ANY (ARRAY['admin','manager','pharmacist'])));

-- invoice_items
CREATE POLICY IF NOT EXISTS invoice_items_all ON public.invoice_items FOR ALL USING ((EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND ((get_user_branch() IS NULL) OR (get_user_branch() = invoices.branch_id)))) AND (get_user_role() = ANY (ARRAY['admin','manager','pharmacist'])));

-- customers
CREATE POLICY IF NOT EXISTS customers_all ON public.customers FOR ALL USING (((get_user_branch() IS NULL) OR (get_user_branch() = branch_id)) AND (get_user_role() = ANY (ARRAY['admin','manager','pharmacist'])));

-- customer_payments
CREATE POLICY IF NOT EXISTS customer_payments_all ON public.customer_payments FOR ALL USING (((get_user_branch() IS NULL) OR (get_user_branch() = branch_id)) AND (get_user_role() = ANY (ARRAY['admin','manager','pharmacist'])));

-- expenses
CREATE POLICY IF NOT EXISTS expenses_all ON public.expenses FOR ALL USING (((get_user_branch() IS NULL) OR (get_user_branch() = branch_id)) AND (get_user_role() = ANY (ARRAY['admin','manager','pharmacist'])));

-- salary_records
CREATE POLICY IF NOT EXISTS salary_all ON public.salary_records FOR ALL USING (((get_user_branch() IS NULL) OR (get_user_branch() = branch_id)) AND (get_user_role() = ANY (ARRAY['admin','manager'])));

-- notices
CREATE POLICY IF NOT EXISTS notices_read  ON public.notices FOR SELECT USING ((get_user_branch() IS NULL) OR (get_user_branch() = branch_id) OR (branch_id IS NULL));
CREATE POLICY IF NOT EXISTS notices_write ON public.notices FOR ALL    USING (get_user_role() = ANY (ARRAY['admin','manager']));

-- system_settings
CREATE POLICY IF NOT EXISTS settings_read  ON public.system_settings FOR SELECT USING (get_user_role() = ANY (ARRAY['admin','manager']));
CREATE POLICY IF NOT EXISTS settings_write ON public.system_settings FOR ALL    USING (get_user_role() = 'admin');

-- tax_rates (uses authenticated role directly)
CREATE POLICY IF NOT EXISTS tax_rates_select_authenticated ON public.tax_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS tax_rates_insert_admin         ON public.tax_rates FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_user_id = auth.uid() AND role = 'admin'));
CREATE POLICY IF NOT EXISTS tax_rates_update_admin         ON public.tax_rates FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_user_id = auth.uid() AND role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_user_id = auth.uid() AND role = 'admin'));
CREATE POLICY IF NOT EXISTS tax_rates_delete_admin         ON public.tax_rates FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_user_id = auth.uid() AND role = 'admin'));
