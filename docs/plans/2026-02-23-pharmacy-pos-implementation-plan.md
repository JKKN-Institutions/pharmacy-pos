# Pharmacy POS System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Build a full-featured pharmacy POS system with offline-capable counter billing, batch-level inventory tracking, credit invoicing, and 9 report types — migrating 39,786+ existing records from CSV.

**Architecture:** Hybrid split — Next.js 16 Server Actions + SSR for all admin modules; client-side PWA island with IndexedDB for POS billing (offline-capable). Supabase provides PostgreSQL, Auth, RLS, and Storage.

**Tech Stack:** Next.js 16.1.6 · React 19.2.3 · TypeScript · Tailwind CSS v4 · shadcn/ui · Supabase · Zustand · Dexie.js (IndexedDB) · @react-pdf/renderer · next-pwa · Recharts · Zod · React Hook Form

**Reference Skill:** `@.claude/skills/nextjs16-web-development` — use for all Server Actions, caching, and component patterns.

**Design Spec:** `docs/plans/2026-02-23-pharmacy-pos-design.md`

**Module Status Tracking:**
```
[ ] Phase 0: Project Setup & Infrastructure
[ ] Phase 1: Auth, Roles & App Shell
[ ] Phase 2: Medicine Catalog, Categories & Suppliers
[ ] Phase 3: Customers
[ ] Phase 4: Purchase Management
[ ] Phase 5: Stock / Inventory Management
[ ] Phase 6: POS Billing (Offline PWA) ← MOST CRITICAL
[ ] Phase 7: Invoice (Credit Billing)
[ ] Phase 8: Expenses, Salary & Accounts
[ ] Phase 9: Reports (9 types)
[ ] Phase 10: Dashboard
[ ] Phase 11: Settings & System Configuration
[ ] Phase 12: Data Migration Module
```

---

## Phase 0: Project Setup & Infrastructure

### Task 0.1: Install Required Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install new packages**

```bash
npm install @supabase/supabase-js @supabase/ssr zustand dexie @react-pdf/renderer next-pwa
npm install @tanstack/react-table
```

**Step 2: Verify installations**

```bash
npm ls @supabase/supabase-js dexie zustand
```
Expected: All packages listed at correct versions.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install pharmacy-pos dependencies (supabase, dexie, zustand, react-pdf, next-pwa)"
```

---

### Task 0.2: Supabase Project Configuration

**Files:**
- Create: `.env.local`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`

**Step 1: Set up environment variables**

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Step 2: Create Supabase browser client**

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 3: Create Supabase server client**

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

**Step 4: Create middleware**

Create `lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

Create `middleware.ts` (root):
```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Step 5: Commit**

```bash
git add lib/supabase/ middleware.ts .env.local
git commit -m "feat: configure supabase client, server, and auth middleware"
```

---

### Task 0.3: Database Schema — Initial Migration (Supabase SQL)

**Files:**
- Create: `supabase/migrations/20260223000001_initial_schema.sql`

**Step 1: Write initial schema migration**

Create `supabase/migrations/20260223000001_initial_schema.sql`:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Branches (single record now, multi-branch ready)
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO branches (name) VALUES ('Main Pharmacy');

-- User profiles (linked to Supabase Auth)
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'pharmacist', 'cashier');

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'cashier',
  branch_id UUID REFERENCES branches(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medicine categories
CREATE TABLE medicine_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  branch_id UUID REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medicine master catalog
CREATE TABLE medicines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  company TEXT,
  generic_name TEXT,
  category_id UUID REFERENCES medicine_categories(id),
  unit TEXT,
  unit_packing TEXT,
  medicine_group TEXT,
  store_location TEXT,
  min_level NUMERIC(10,2) DEFAULT 0,
  reorder_level NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  branch_id UUID REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX medicines_name_idx ON medicines USING gin(to_tsvector('english', name));
CREATE INDEX medicines_branch_idx ON medicines(branch_id);

-- Suppliers
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  pincode TEXT,
  branch_id UUID REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  blood_group TEXT,
  dob DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  pincode TEXT,
  branch_id UUID REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchases (supplier invoices)
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES suppliers(id),
  invoice_no TEXT NOT NULL,
  purchase_date DATE NOT NULL,
  subtotal NUMERIC(12,2) DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  tax NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  branch_id UUID REFERENCES branches(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase line items
CREATE TABLE purchase_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
  medicine_id UUID REFERENCES medicines(id),
  batch_no TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  packing_qty NUMERIC(10,2) DEFAULT 1,
  quantity NUMERIC(10,2) NOT NULL,
  total_qty NUMERIC(10,2) NOT NULL,
  purchase_price NUMERIC(10,2) NOT NULL,
  sale_price NUMERIC(10,2) NOT NULL,
  discount_type TEXT DEFAULT 'percent' CHECK (discount_type IN ('percent', 'flat')),
  discount_value NUMERIC(10,2) DEFAULT 0,
  tax NUMERIC(10,2) DEFAULT 0,
  price NUMERIC(12,2) NOT NULL
);

-- Stock batches (THE inventory truth table)
CREATE TABLE stock_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medicine_id UUID REFERENCES medicines(id),
  purchase_id UUID REFERENCES purchases(id),
  batch_no TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  purchase_price NUMERIC(10,2) NOT NULL,
  sale_price NUMERIC(10,2) NOT NULL,
  initial_qty NUMERIC(10,2) NOT NULL,
  sold_qty NUMERIC(10,2) DEFAULT 0,
  available_qty NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'written_off')),
  branch_id UUID REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX stock_batches_medicine_idx ON stock_batches(medicine_id, expiry_date, status);

-- POS Bills (counter cash sales)
CREATE TYPE payment_method AS ENUM ('cash', 'upi', 'card', 'credit');

CREATE TABLE pos_bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_no TEXT NOT NULL UNIQUE,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  doctor TEXT,
  payment_method payment_method DEFAULT 'cash',
  subtotal NUMERIC(12,2) DEFAULT 0,
  discount_total NUMERIC(12,2) DEFAULT 0,
  tax_total NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL,
  paid NUMERIC(12,2) DEFAULT 0,
  due NUMERIC(12,2) DEFAULT 0,
  note TEXT,
  bill_date DATE NOT NULL,
  status TEXT DEFAULT 'saved' CHECK (status IN ('saved', 'synced', 'sync_error')),
  synced_at TIMESTAMPTZ,
  branch_id UUID REFERENCES branches(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX pos_bills_date_idx ON pos_bills(bill_date, branch_id);

-- POS Bill line items
CREATE TABLE pos_bill_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id UUID REFERENCES pos_bills(id) ON DELETE CASCADE,
  medicine_id UUID REFERENCES medicines(id),
  stock_batch_id UUID REFERENCES stock_batches(id),
  batch_no TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  qty NUMERIC(10,2) NOT NULL,
  sale_price NUMERIC(10,2) NOT NULL,
  discount_type TEXT DEFAULT 'percent' CHECK (discount_type IN ('percent', 'flat')),
  discount_value NUMERIC(10,2) DEFAULT 0,
  tax NUMERIC(10,2) DEFAULT 0,
  price NUMERIC(12,2) NOT NULL
);

-- Invoices (credit/institutional)
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_no TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES customers(id),
  payment_method payment_method DEFAULT 'credit',
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
  invoice_status TEXT DEFAULT 'draft' CHECK (invoice_status IN ('draft', 'sent', 'paid')),
  invoice_date DATE NOT NULL,
  due_date DATE,
  subtotal NUMERIC(12,2) DEFAULT 0,
  discount_total NUMERIC(12,2) DEFAULT 0,
  tax_total NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL,
  paid NUMERIC(12,2) DEFAULT 0,
  due NUMERIC(12,2) DEFAULT 0,
  customer_note TEXT,
  terms_conditions TEXT,
  branch_id UUID REFERENCES branches(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice line items
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_description TEXT,
  qty NUMERIC(10,2) NOT NULL,
  unit_cost NUMERIC(10,2) NOT NULL,
  discount_type TEXT DEFAULT 'percent' CHECK (discount_type IN ('percent', 'flat')),
  discount_value NUMERIC(10,2) DEFAULT 0,
  tax NUMERIC(10,2) DEFAULT 0,
  price NUMERIC(12,2) NOT NULL
);

-- Expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  expense_type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  method payment_method DEFAULT 'cash',
  date DATE NOT NULL,
  description TEXT,
  branch_id UUID REFERENCES branches(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Salary records (simple payment ledger)
CREATE TABLE salary_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  method payment_method DEFAULT 'cash',
  date DATE NOT NULL,
  note TEXT,
  branch_id UUID REFERENCES branches(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notices / bulletin board
CREATE TABLE notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  branch_id UUID REFERENCES branches(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer credit payments
CREATE TABLE customer_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id),
  invoice_id UUID REFERENCES invoices(id),
  amount NUMERIC(12,2) NOT NULL,
  method payment_method DEFAULT 'cash',
  date DATE NOT NULL,
  note TEXT,
  branch_id UUID REFERENCES branches(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto bill_no sequence function
CREATE SEQUENCE pos_bill_seq START 1;
CREATE OR REPLACE FUNCTION generate_bill_no() RETURNS TEXT AS $$
  SELECT 'INV-' || LPAD(nextval('pos_bill_seq')::TEXT, 5, '0');
$$ LANGUAGE SQL;

-- Auto invoice_no sequence
CREATE SEQUENCE invoice_seq START 1;
CREATE OR REPLACE FUNCTION generate_invoice_no() RETURNS TEXT AS $$
  SELECT 'INV-' || LPAD(nextval('invoice_seq')::TEXT, 5, '0');
$$ LANGUAGE SQL;
```

**Step 2: Apply migration via Supabase MCP**

Use Supabase MCP tool: `mcp__supabase__apply_migration` with the SQL above.

**Step 3: Verify tables exist**

Use Supabase MCP: `mcp__supabase__list_tables` — confirm all tables created.

**Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: initial database schema with all pharmacy-pos tables"
```

---

### Task 0.4: RLS Policies Migration

**Files:**
- Create: `supabase/migrations/20260223000002_rls_policies.sql`

**Step 1: Write RLS policies**

```sql
-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_user_role() RETURNS TEXT AS $$
  SELECT role::TEXT FROM user_profiles WHERE auth_user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function: get current user's branch
CREATE OR REPLACE FUNCTION get_user_branch() RETURNS UUID AS $$
  SELECT branch_id FROM user_profiles WHERE auth_user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Generic branch-scoped read policy for managers/admins/pharmacists
-- (Cashier can only read medicines and stock for POS)
-- POS Bills: Cashier can create + read own, others see all in branch
CREATE POLICY "pos_bills_insert" ON pos_bills
  FOR INSERT WITH CHECK (get_user_branch() = branch_id);

CREATE POLICY "pos_bills_select" ON pos_bills
  FOR SELECT USING (get_user_branch() = branch_id);

CREATE POLICY "pos_bills_delete" ON pos_bills
  FOR DELETE USING (get_user_role() IN ('admin', 'manager'));

-- Medicines: all roles can read, pharmacist+ can write
CREATE POLICY "medicines_read" ON medicines
  FOR SELECT USING (get_user_branch() = branch_id OR branch_id IS NULL);

CREATE POLICY "medicines_write" ON medicines
  FOR ALL USING (get_user_role() IN ('admin', 'manager', 'pharmacist'));

-- Stock batches: pharmacist+ can read/write, cashier read-only
CREATE POLICY "stock_read" ON stock_batches
  FOR SELECT USING (get_user_branch() = branch_id OR branch_id IS NULL);

CREATE POLICY "stock_write" ON stock_batches
  FOR ALL USING (get_user_role() IN ('admin', 'manager', 'pharmacist'));

-- Reports/Expenses/Salary: manager+ only
CREATE POLICY "expenses_all" ON expenses
  FOR ALL USING (
    get_user_branch() = branch_id AND
    get_user_role() IN ('admin', 'manager')
  );

CREATE POLICY "salary_all" ON salary_records
  FOR ALL USING (
    get_user_branch() = branch_id AND
    get_user_role() IN ('admin', 'manager')
  );

-- Invoices: pharmacist+
CREATE POLICY "invoices_all" ON invoices
  FOR ALL USING (
    get_user_branch() = branch_id AND
    get_user_role() IN ('admin', 'manager', 'pharmacist')
  );

-- Users: admin only
CREATE POLICY "users_admin" ON user_profiles
  FOR ALL USING (get_user_role() = 'admin');
```

**Step 2: Apply via Supabase MCP**

**Step 3: Commit**

```bash
git add supabase/migrations/20260223000002_rls_policies.sql
git commit -m "feat: supabase RLS policies for all 4 user roles"
```

---

### Task 0.5: TypeScript Types & Shared Utilities

**Files:**
- Create: `lib/types/database.ts`
- Create: `lib/types/index.ts`
- Create: `lib/utils/currency.ts`
- Create: `lib/utils/billing.ts`

**Step 1: Create database types**

Create `lib/types/database.ts`:
```typescript
export type UserRole = 'admin' | 'manager' | 'pharmacist' | 'cashier'
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'credit'
export type DiscountType = 'percent' | 'flat'
export type MedicineStatus = 'active' | 'inactive'
export type StockStatus = 'active' | 'expired' | 'written_off'
export type BillStatus = 'saved' | 'synced' | 'sync_error'
export type InvoiceStatus = 'draft' | 'sent' | 'paid'
export type PaymentStatus = 'paid' | 'partial' | 'unpaid'

export interface Branch {
  id: string
  name: string
  address: string | null
  is_active: boolean
  created_at: string
}

export interface UserProfile {
  id: string
  auth_user_id: string
  name: string
  email: string
  phone: string | null
  role: UserRole
  branch_id: string | null
  is_active: boolean
  created_at: string
}

export interface MedicineCategory {
  id: string
  name: string
  branch_id: string | null
  created_at: string
}

export interface Medicine {
  id: string
  name: string
  aliases: string[]
  company: string | null
  generic_name: string | null
  category_id: string | null
  unit: string | null
  unit_packing: string | null
  medicine_group: string | null
  store_location: string | null
  min_level: number
  reorder_level: number
  status: MedicineStatus
  branch_id: string | null
  created_at: string
  updated_at: string
  medicine_categories?: MedicineCategory
}

export interface Supplier {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  pincode: string | null
  branch_id: string | null
  created_at: string
}

export interface Customer {
  id: string
  first_name: string
  last_name: string | null
  email: string | null
  phone: string
  blood_group: string | null
  dob: string | null
  gender: 'male' | 'female' | 'other' | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  pincode: string | null
  branch_id: string | null
  created_at: string
}

export interface StockBatch {
  id: string
  medicine_id: string
  purchase_id: string | null
  batch_no: string
  expiry_date: string
  purchase_price: number
  sale_price: number
  initial_qty: number
  sold_qty: number
  available_qty: number
  status: StockStatus
  branch_id: string | null
  created_at: string
  medicines?: Medicine
}

export interface PosBill {
  id: string
  bill_no: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  doctor: string | null
  payment_method: PaymentMethod
  subtotal: number
  discount_total: number
  tax_total: number
  total: number
  paid: number
  due: number
  note: string | null
  bill_date: string
  status: BillStatus
  synced_at: string | null
  branch_id: string | null
  created_by: string | null
  created_at: string
  pos_bill_items?: PosBillItem[]
}

export interface PosBillItem {
  id: string
  bill_id: string
  medicine_id: string
  stock_batch_id: string
  batch_no: string
  expiry_date: string
  qty: number
  sale_price: number
  discount_type: DiscountType
  discount_value: number
  tax: number
  price: number
  medicines?: Medicine
}

export interface Purchase {
  id: string
  supplier_id: string | null
  invoice_no: string
  purchase_date: string
  subtotal: number
  discount: number
  tax: number
  total: number
  branch_id: string | null
  created_by: string | null
  created_at: string
  suppliers?: Supplier
  purchase_items?: PurchaseItem[]
}

export interface PurchaseItem {
  id: string
  purchase_id: string
  medicine_id: string
  batch_no: string
  expiry_date: string
  packing_qty: number
  quantity: number
  total_qty: number
  purchase_price: number
  sale_price: number
  discount_type: DiscountType
  discount_value: number
  tax: number
  price: number
  medicines?: Medicine
}

export interface Invoice {
  id: string
  invoice_no: string
  customer_id: string | null
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  invoice_status: InvoiceStatus
  invoice_date: string
  due_date: string | null
  subtotal: number
  discount_total: number
  tax_total: number
  total: number
  paid: number
  due: number
  customer_note: string | null
  terms_conditions: string | null
  branch_id: string | null
  created_by: string | null
  created_at: string
  customers?: Customer
  invoice_items?: InvoiceItem[]
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  item_name: string
  item_description: string | null
  qty: number
  unit_cost: number
  discount_type: DiscountType
  discount_value: number
  tax: number
  price: number
}

export interface Expense {
  id: string
  name: string
  expense_type: string
  amount: number
  method: PaymentMethod
  date: string
  description: string | null
  branch_id: string | null
  created_by: string | null
  created_at: string
}

export interface SalaryRecord {
  id: string
  staff_name: string
  amount: number
  method: PaymentMethod
  date: string
  note: string | null
  branch_id: string | null
  created_by: string | null
  created_at: string
}

export interface Notice {
  id: string
  title: string
  description: string | null
  start_date: string | null
  end_date: string | null
  status: 'active' | 'inactive'
  branch_id: string | null
  created_by: string | null
  created_at: string
}
```

**Step 2: Create billing calculation utility**

Create `lib/utils/billing.ts`:
```typescript
import type { DiscountType } from '@/lib/types/database'

export interface LineItemInput {
  qty: number
  unit_price: number
  discount_type: DiscountType
  discount_value: number
  tax: number  // tax percentage
}

export interface LineItemTotals {
  subtotal: number      // qty × unit_price
  discount: number      // calculated discount amount
  tax_amount: number    // calculated tax amount
  price: number         // final price
}

export function calculateLineItem(item: LineItemInput): LineItemTotals {
  const subtotal = item.qty * item.unit_price

  const discount =
    item.discount_type === 'percent'
      ? subtotal * (item.discount_value / 100)
      : item.discount_value

  const taxable = subtotal - discount
  const tax_amount = taxable * (item.tax / 100)
  const price = taxable + tax_amount

  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    tax_amount: round2(tax_amount),
    price: round2(price),
  }
}

export function calculateBillTotals(items: LineItemTotals[]) {
  return {
    subtotal: round2(items.reduce((s, i) => s + i.subtotal, 0)),
    discount_total: round2(items.reduce((s, i) => s + i.discount, 0)),
    tax_total: round2(items.reduce((s, i) => s + i.tax_amount, 0)),
    total: round2(items.reduce((s, i) => s + i.price, 0)),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
```

**Step 3: Create currency formatter**

Create `lib/utils/currency.ts`:
```typescript
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatINRCompact(amount: number): string {
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)}L`
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`
  }
  return `₹${amount.toFixed(2)}`
}
```

**Step 4: Commit**

```bash
git add lib/
git commit -m "feat: typescript types, billing calculations, and currency utilities"
```

---

### Task 0.6: App Shell, Layout & Theme Setup

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Create: `app/(dashboard)/layout.tsx`
- Create: `components/layout/sidebar.tsx`
- Create: `components/layout/topbar.tsx`
- Create: `components/providers/theme-provider.tsx`

**Step 1: Update globals.css with pharmacy brand colors**

Update `app/globals.css`:
```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(0.98 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --primary: oklch(0.4 0.15 250);        /* Pharmacy blue */
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.96 0 0);
  --secondary-foreground: oklch(0.2 0 0);
  --muted: oklch(0.96 0 0);
  --muted-foreground: oklch(0.5 0 0);
  --accent: oklch(0.96 0 0);
  --accent-foreground: oklch(0.2 0 0);
  --destructive: oklch(0.6 0.22 25);
  --border: oklch(0.9 0 0);
  --input: oklch(0.9 0 0);
  --ring: oklch(0.4 0.15 250);
  --sidebar: oklch(0.15 0.05 250);       /* Dark navy sidebar */
  --sidebar-foreground: oklch(0.9 0 0);
  --sidebar-accent: oklch(0.25 0.08 250);
  --radius: 0.5rem;
}

.dark {
  --background: oklch(0.08 0.02 250);
  --foreground: oklch(0.95 0 0);
  --card: oklch(0.12 0.02 250);
  --card-foreground: oklch(0.95 0 0);
  --primary: oklch(0.6 0.15 250);
  --primary-foreground: oklch(0.1 0 0);
  --muted: oklch(0.18 0.02 250);
  --muted-foreground: oklch(0.65 0 0);
  --border: oklch(0.2 0.02 250);
  --input: oklch(0.2 0.02 250);
}
```

**Step 2: Create theme provider**

Create `components/providers/theme-provider.tsx`:
```typescript
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

**Step 3: Create sidebar navigation component**

Create `components/layout/sidebar.tsx`:
```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, ShoppingCart, FileText, Package,
  ClipboardList, Archive, Users, Truck, DollarSign,
  BarChart3, Settings, Pill, Receipt, BookOpen
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'manager'] },
  { href: '/pos', icon: ShoppingCart, label: 'POS / Bill', roles: ['admin', 'manager', 'pharmacist', 'cashier'] },
  { href: '/invoices', icon: FileText, label: 'Invoices', roles: ['admin', 'manager', 'pharmacist'] },
  { href: '/purchases', icon: ClipboardList, label: 'Purchase', roles: ['admin', 'manager', 'pharmacist'] },
  { href: '/stock', icon: Archive, label: 'Live Stock', roles: ['admin', 'manager', 'pharmacist'] },
  { href: '/medicines', icon: Pill, label: 'Medicines', roles: ['admin', 'manager', 'pharmacist'] },
  { href: '/customers', icon: Users, label: 'Customers', roles: ['admin', 'manager', 'pharmacist'] },
  { href: '/suppliers', icon: Truck, label: 'Suppliers', roles: ['admin', 'manager', 'pharmacist'] },
  { href: '/expenses', icon: DollarSign, label: 'Expenses', roles: ['admin', 'manager'] },
  { href: '/salary', icon: Receipt, label: 'Salary', roles: ['admin', 'manager'] },
  { href: '/accounts', icon: BookOpen, label: 'Accounts', roles: ['admin', 'manager'] },
  { href: '/reports', icon: BarChart3, label: 'Reports', roles: ['admin', 'manager'] },
  { href: '/settings', icon: Settings, label: 'Settings', roles: ['admin'] },
]

interface SidebarProps {
  userRole: string
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname()

  const visibleItems = navItems.filter(item =>
    item.roles.includes(userRole)
  )

  return (
    <aside className="fixed left-0 top-0 h-full w-16 bg-sidebar flex flex-col items-center py-4 gap-1 z-40">
      {/* Logo */}
      <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center mb-4">
        <Pill className="w-5 h-5 text-white" />
      </div>

      {visibleItems.map((item) => {
        const isActive = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
              'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent',
              isActive && 'bg-sidebar-accent text-sidebar-foreground'
            )}
          >
            <item.icon className="w-5 h-5" />
          </Link>
        )
      })}
    </aside>
  )
}
```

**Step 4: Create dashboard layout**

Create `app/(dashboard)/layout.tsx`:
```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar userRole={profile.role} />
      <div className="flex-1 ml-16 flex flex-col">
        <Topbar user={profile} />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

**Step 5: Commit**

```bash
git add app/ components/
git commit -m "feat: app shell with sidebar navigation, theme provider, and dashboard layout"
```

---

## Phase 1: Auth & User Management

### Task 1.1: Login Page

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/login/actions.ts`

**Step 1: Create login page**

Create `app/login/page.tsx`:
```typescript
import { loginAction } from './actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Pill } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center mb-3">
            <Pill className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl">Pharmacy POS</CardTitle>
          <p className="text-muted-foreground text-sm">Sign in to your account</p>
        </CardHeader>
        <CardContent>
          <form action={loginAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="your@email.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button type="submit" className="w-full">Sign In</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

Create `app/login/actions.ts`:
```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function loginAction(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?error=Invalid credentials')
  }

  redirect('/dashboard')
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

**Step 2: Commit**

```bash
git add app/login/
git commit -m "feat: login page with supabase auth sign-in"
```

---

### Task 1.2: User Management (Admin Only)

**Files:**
- Create: `app/(dashboard)/users/page.tsx`
- Create: `app/(dashboard)/users/actions.ts`
- Create: `app/(dashboard)/users/columns.tsx`
- Create: `components/users/user-form.tsx`

**Step 1: Create user listing page with DataTable**

Create `app/(dashboard)/users/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DataTable } from '@/components/ui/data-table'
import { userColumns } from './columns'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: users } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Button asChild>
          <Link href="/users/new">
            <Plus className="w-4 h-4 mr-2" />
            New User
          </Link>
        </Button>
      </div>
      <DataTable columns={userColumns} data={users ?? []} />
    </div>
  )
}
```

**Step 2: Create Server Actions for users**

Create `app/(dashboard)/users/actions.ts`:
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(['admin', 'manager', 'pharmacist', 'cashier']),
  password: z.string().min(8).optional(),
})

export async function createUserAction(formData: FormData) {
  const parsed = userSchema.parse(Object.fromEntries(formData))
  const supabase = await createClient()

  // Create Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password ?? 'TempPass123!',
    email_confirm: true,
  })

  if (authError) return { error: authError.message }

  // Create profile
  await supabase.from('user_profiles').insert({
    auth_user_id: authData.user.id,
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone,
    role: parsed.role,
  })

  revalidatePath('/users')
  return { success: true }
}
```

**Step 3: Commit**

```bash
git add app/(dashboard)/users/ components/users/
git commit -m "feat: user management module with CRUD and role assignment"
```

---

## Phase 2: Medicine Catalog, Categories & Suppliers

### Task 2.1: Medicine Categories

**Files:**
- Create: `app/(dashboard)/medicine-categories/page.tsx`
- Create: `app/(dashboard)/medicine-categories/actions.ts`

**Step 1: Medicine categories page (list + inline add)**

Create `app/(dashboard)/medicine-categories/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { DataTable } from '@/components/ui/data-table'
import { categoryColumns } from './columns'
import { CategoryForm } from '@/components/medicines/category-form'

export default async function MedicineCategoriesPage() {
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('medicine_categories')
    .select('*')
    .order('name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Medicine Category</h1>
        <CategoryForm />
      </div>
      <DataTable columns={categoryColumns} data={categories ?? []} searchKey="name" />
    </div>
  )
}
```

**Step 2: Categories Server Actions**

Create `app/(dashboard)/medicine-categories/actions.ts`:
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createCategoryAction(name: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('medicine_categories').insert({ name })
  if (error) return { error: error.message }
  revalidatePath('/medicine-categories')
  return { success: true }
}

export async function updateCategoryAction(id: string, name: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('medicine_categories')
    .update({ name })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/medicine-categories')
  return { success: true }
}

export async function deleteCategoryAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('medicine_categories').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/medicine-categories')
  return { success: true }
}
```

**Step 3: Commit**

```bash
git add app/(dashboard)/medicine-categories/
git commit -m "feat: medicine categories CRUD"
```

---

### Task 2.2: Medicine Catalog (Full CRUD + Import/Export)

**Files:**
- Create: `app/(dashboard)/medicines/page.tsx`
- Create: `app/(dashboard)/medicines/new/page.tsx`
- Create: `app/(dashboard)/medicines/[id]/edit/page.tsx`
- Create: `app/(dashboard)/medicines/actions.ts`
- Create: `components/medicines/medicine-form.tsx`
- Create: `app/(dashboard)/medicines/import/route.ts`

**Step 1: Medicine listing with search + status filter**

Create `app/(dashboard)/medicines/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { DataTable } from '@/components/ui/data-table'
import { medicineColumns } from './columns'
import { Button } from '@/components/ui/button'
import { Plus, Upload, Download } from 'lucide-react'
import Link from 'next/link'

export default async function MedicinesPage({
  searchParams,
}: {
  searchParams: { page?: string; search?: string; status?: string }
}) {
  const supabase = await createClient()
  const page = parseInt(searchParams.page ?? '1')
  const pageSize = 10
  const from = (page - 1) * pageSize

  let query = supabase
    .from('medicines')
    .select('*, medicine_categories(name)', { count: 'exact' })
    .order('name')
    .range(from, from + pageSize - 1)

  if (searchParams.search) {
    query = query.ilike('name', `%${searchParams.search}%`)
  }
  if (searchParams.status) {
    query = query.eq('status', searchParams.status)
  }

  const { data: medicines, count } = await query

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Medicines</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/medicines/import"><Upload className="w-4 h-4 mr-2" />Import</Link>
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />Export
          </Button>
          <Button asChild>
            <Link href="/medicines/new"><Plus className="w-4 h-4 mr-2" />New Medicine</Link>
          </Button>
        </div>
      </div>
      <DataTable
        columns={medicineColumns}
        data={medicines ?? []}
        totalCount={count ?? 0}
        pageSize={pageSize}
      />
    </div>
  )
}
```

**Step 2: Medicine form (add/edit)**

Create `components/medicines/medicine-form.tsx` — full form with all fields from design spec (Name, Category, Company, Generic, Group, Unit, Unit/Packing, Store Location, Min Level, Reorder Level, Status, Note).

**Step 3: Medicine Server Actions**

Create `app/(dashboard)/medicines/actions.ts`:
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const medicineSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  generic_name: z.string().optional(),
  category_id: z.string().uuid().optional(),
  unit: z.string().optional(),
  unit_packing: z.string().optional(),
  medicine_group: z.string().optional(),
  store_location: z.string().optional(),
  min_level: z.coerce.number().default(0),
  reorder_level: z.coerce.number().default(0),
  status: z.enum(['active', 'inactive']).default('active'),
})

export async function createMedicineAction(formData: FormData) {
  const parsed = medicineSchema.parse(Object.fromEntries(formData))
  const supabase = await createClient()
  const { error } = await supabase.from('medicines').insert(parsed)
  if (error) return { error: error.message }
  revalidatePath('/medicines')
  return { success: true }
}

export async function updateMedicineAction(id: string, formData: FormData) {
  const parsed = medicineSchema.parse(Object.fromEntries(formData))
  const supabase = await createClient()
  const { error } = await supabase.from('medicines').update(parsed).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/medicines')
  revalidatePath(`/medicines/${id}/edit`)
  return { success: true }
}

export async function deleteMedicineAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('medicines').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/medicines')
  return { success: true }
}
```

**Step 4: Excel import route**

Create `app/api/medicines/import/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]

  const supabase = await createClient()
  const medicines = rows.map(row => ({
    name: String(row['Medicine Name'] ?? ''),
    company: String(row['Company'] ?? ''),
    generic_name: String(row['Generic Name'] ?? ''),
    unit: String(row['Unit'] ?? ''),
    unit_packing: String(row['Unit/Packing'] ?? ''),
    status: 'active',
  })).filter(m => m.name)

  const { error, data } = await supabase.from('medicines').insert(medicines).select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ imported: data?.length ?? 0 })
}
```

**Step 5: Commit**

```bash
git add app/(dashboard)/medicines/ components/medicines/ app/api/medicines/
git commit -m "feat: medicine catalog CRUD with Excel import/export"
```

---

### Task 2.3: Suppliers CRUD

**Files:**
- Create: `app/(dashboard)/suppliers/page.tsx`
- Create: `app/(dashboard)/suppliers/actions.ts`
- Create: `components/suppliers/supplier-form.tsx`

Similar structure to medicines — list page, add/edit form, Server Actions for CRUD.

**Step 1: Create supplier pages and actions** (same pattern as medicines above)

**Step 2: Commit**

```bash
git add app/(dashboard)/suppliers/
git commit -m "feat: suppliers CRUD module"
```

---

## Phase 3: Customers

### Task 3.1: Customer Management

**Files:**
- Create: `app/(dashboard)/customers/page.tsx`
- Create: `app/(dashboard)/customers/new/page.tsx`
- Create: `app/(dashboard)/customers/actions.ts`
- Create: `components/customers/customer-form.tsx`

**Step 1: Customer form with all fields**

Customer form fields from design spec: First Name, Last Name, Email, Mobile (required), Date of Birth, Blood Group, Gender, Address Line 1, Address Line 2, City, Pincode.

**Step 2: Commit**

```bash
git add app/(dashboard)/customers/
git commit -m "feat: customer management with medical details"
```

---

## Phase 4: Purchase Management

### Task 4.1: Purchase List

**Files:**
- Create: `app/(dashboard)/purchases/page.tsx`
- Create: `app/(dashboard)/purchases/new/page.tsx`
- Create: `app/(dashboard)/purchases/[id]/page.tsx`
- Create: `app/(dashboard)/purchases/actions.ts`

**Step 1: Purchase list with date range filter**

Create `app/(dashboard)/purchases/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { DataTable } from '@/components/ui/data-table'
import { purchaseColumns } from './columns'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string }
}) {
  const supabase = await createClient()

  let query = supabase
    .from('purchases')
    .select('*, suppliers(name)', { count: 'exact' })
    .order('purchase_date', { ascending: false })

  if (searchParams.from) query = query.gte('purchase_date', searchParams.from)
  if (searchParams.to) query = query.lte('purchase_date', searchParams.to)

  const { data: purchases, count } = await query

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Purchase</h1>
        <Button asChild>
          <Link href="/purchases/new"><Plus className="w-4 h-4 mr-2" />New Purchase</Link>
        </Button>
      </div>
      <DataTable columns={purchaseColumns} data={purchases ?? []} />
    </div>
  )
}
```

**Step 2: New Purchase form (complex line-item form)**

This is the most complex form. Key behaviors:
- Supplier dropdown (searchable)
- Line items: Medicine search → autocomplete from DB → fills batch/expiry fields
- Multiple line items via dynamic array (React Hook Form `useFieldArray`)
- Real-time totals calculation using `lib/utils/billing.ts`
- On save: creates purchase + purchase_items + stock_batches atomically

**Step 3: Purchase Server Action with stock creation**

Create `app/(dashboard)/purchases/actions.ts`:
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createPurchaseAction(data: {
  supplier_id: string
  invoice_no: string
  purchase_date: string
  items: Array<{
    medicine_id: string
    batch_no: string
    expiry_date: string
    packing_qty: number
    quantity: number
    purchase_price: number
    sale_price: number
    discount_type: 'percent' | 'flat'
    discount_value: number
    tax: number
    price: number
  }>
  subtotal: number
  discount: number
  tax: number
  total: number
}) {
  const supabase = await createClient()

  // 1. Create purchase
  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .insert({
      supplier_id: data.supplier_id,
      invoice_no: data.invoice_no,
      purchase_date: data.purchase_date,
      subtotal: data.subtotal,
      discount: data.discount,
      tax: data.tax,
      total: data.total,
    })
    .select('id')
    .single()

  if (purchaseError) return { error: purchaseError.message }

  // 2. Create purchase items
  await supabase.from('purchase_items').insert(
    data.items.map(item => ({ ...item, purchase_id: purchase.id }))
  )

  // 3. Create stock batches (auto stock update on save)
  await supabase.from('stock_batches').insert(
    data.items.map(item => ({
      medicine_id: item.medicine_id,
      purchase_id: purchase.id,
      batch_no: item.batch_no,
      expiry_date: item.expiry_date,
      purchase_price: item.purchase_price,
      sale_price: item.sale_price,
      initial_qty: item.quantity * item.packing_qty,
      sold_qty: 0,
      available_qty: item.quantity * item.packing_qty,
    }))
  )

  revalidatePath('/purchases')
  revalidatePath('/stock')
  return { success: true, id: purchase.id }
}
```

**Step 4: Commit**

```bash
git add app/(dashboard)/purchases/
git commit -m "feat: purchase management with automatic stock batch creation"
```

---

## Phase 5: Stock / Inventory Management

### Task 5.1: Live Stock & Expire Stock View

**Files:**
- Create: `app/(dashboard)/stock/page.tsx`
- Create: `app/(dashboard)/stock/actions.ts`

**Step 1: Stock view with toggle and expiry color coding**

Create `app/(dashboard)/stock/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { DataTable } from '@/components/ui/data-table'
import { stockColumns } from './columns'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { StockToggle } from '@/components/stock/stock-toggle'

export default async function StockPage({
  searchParams,
}: {
  searchParams: { view?: 'live' | 'expired'; page?: string }
}) {
  const view = searchParams.view ?? 'live'
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  let query = supabase
    .from('stock_batches')
    .select('*, medicines(name, company)', { count: 'exact' })
    .order('expiry_date', { ascending: true })

  if (view === 'live') {
    query = query.eq('status', 'active').gte('expiry_date', today)
  } else {
    query = query.or(`status.eq.expired,expiry_date.lt.${today}`)
  }

  const { data: stock, count } = await query

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Live Stock</h1>
        <div className="flex gap-2">
          <StockToggle current={view} />
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />Export
          </Button>
        </div>
      </div>
      <DataTable
        columns={stockColumns}
        data={stock ?? []}
        totalCount={count ?? 0}
      />
    </div>
  )
}
```

Key: Expiry date column uses color coding:
- Red: expired (past today)
- Orange: expiring within 30 days
- Normal: > 30 days

**Step 2: Stock adjustment action (for write-offs)**

```typescript
export async function writeOffStockAction(batchId: string, reason: string) {
  const supabase = await createClient()

  const { data: batch } = await supabase
    .from('stock_batches')
    .select('*')
    .eq('id', batchId)
    .single()

  if (!batch) return { error: 'Batch not found' }

  // Mark batch as written off
  await supabase.from('stock_batches').update({
    status: 'written_off',
    available_qty: 0,
  }).eq('id', batchId)

  // Create expense entry for the loss
  await supabase.from('expenses').insert({
    name: `Stock Write-Off: ${batch.batch_no}`,
    expense_type: 'Stock Write-off',
    amount: batch.purchase_price * batch.available_qty,
    method: 'cash',
    date: new Date().toISOString().split('T')[0],
    description: reason,
  })

  revalidatePath('/stock')
  revalidatePath('/expenses')
}
```

**Step 3: Commit**

```bash
git add app/(dashboard)/stock/
git commit -m "feat: live stock and expire stock views with write-off functionality"
```

---

## Phase 6: POS Billing (Offline PWA) ← HIGHEST PRIORITY

### Task 6.1: PWA Setup

**Files:**
- Modify: `next.config.ts`
- Create: `public/manifest.json`
- Create: `lib/offline/db.ts`

**Step 1: Configure next-pwa**

Update `next.config.ts`:
```typescript
import type { NextConfig } from 'next'
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^\/pos/,
      handler: 'NetworkFirst',
      options: { cacheName: 'pos-cache' },
    },
  ],
})

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
  },
}

export default withPWA(nextConfig)
```

Create `public/manifest.json`:
```json
{
  "name": "Pharmacy POS",
  "short_name": "PharmPOS",
  "description": "Pharmacy Point of Sale System",
  "start_url": "/pos",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a1f3a",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Step 2: Create Dexie IndexedDB schema**

Create `lib/offline/db.ts`:
```typescript
import Dexie, { type EntityTable } from 'dexie'

interface OfflineMedicine {
  id: string
  name: string
  company: string | null
  batches: Array<{
    id: string
    batch_no: string
    expiry_date: string
    sale_price: number
    available_qty: number
  }>
  last_synced_at: string
}

interface OfflineBill {
  id: string  // local UUID
  bill_data: {
    customer_name?: string
    customer_email?: string
    customer_phone?: string
    doctor?: string
    payment_method: string
    items: Array<{
      medicine_id: string
      stock_batch_id: string
      batch_no: string
      expiry_date: string
      qty: number
      sale_price: number
      discount_type: 'percent' | 'flat'
      discount_value: number
      tax: number
      price: number
    }>
    subtotal: number
    discount_total: number
    tax_total: number
    total: number
    paid: number
    due: number
    note?: string
    bill_date: string
  }
  created_at: string
  sync_status: 'pending' | 'synced' | 'error'
  error_message?: string
  synced_bill_no?: string
}

class PharmacyDB extends Dexie {
  medicines!: EntityTable<OfflineMedicine, 'id'>
  offline_bills!: EntityTable<OfflineBill, 'id'>

  constructor() {
    super('PharmacyPOS')
    this.version(1).stores({
      medicines: 'id, name, *batches',
      offline_bills: 'id, sync_status, created_at',
    })
  }
}

export const db = new PharmacyDB()
export type { OfflineMedicine, OfflineBill }
```

**Step 3: Commit**

```bash
git add next.config.ts public/manifest.json lib/offline/
git commit -m "feat: PWA setup with manifest, next-pwa, and IndexedDB schema (Dexie)"
```

---

### Task 6.2: POS Medicine Sync to IndexedDB

**Files:**
- Create: `app/api/pos/sync/route.ts`
- Create: `lib/offline/sync.ts`

**Step 1: Create sync API endpoint**

Create `app/api/pos/sync/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Called when POS page loads to sync medicine catalog to IndexedDB
export async function GET() {
  const supabase = await createClient()

  const { data: medicines } = await supabase
    .from('medicines')
    .select(`
      id, name, company,
      stock_batches!inner(
        id, batch_no, expiry_date, sale_price, available_qty
      )
    `)
    .eq('status', 'active')
    .gt('stock_batches.available_qty', 0)
    .order('name')

  return NextResponse.json({ medicines, synced_at: new Date().toISOString() })
}
```

**Step 2: Create sync utility**

Create `lib/offline/sync.ts`:
```typescript
import { db } from './db'

export async function syncMedicines() {
  try {
    const res = await fetch('/api/pos/sync')
    if (!res.ok) return false

    const { medicines, synced_at } = await res.json()

    await db.transaction('rw', db.medicines, async () => {
      await db.medicines.clear()
      await db.medicines.bulkAdd(
        medicines.map((m: any) => ({ ...m, last_synced_at: synced_at }))
      )
    })
    return true
  } catch {
    return false  // offline — use existing IndexedDB data
  }
}

export async function flushOfflineBills() {
  const pending = await db.offline_bills
    .where('sync_status').equals('pending')
    .toArray()

  for (const bill of pending) {
    try {
      const res = await fetch('/api/pos/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bill.bill_data),
      })

      if (res.ok) {
        const { bill_no } = await res.json()
        await db.offline_bills.update(bill.id, {
          sync_status: 'synced',
          synced_bill_no: bill_no,
        })
      } else {
        await db.offline_bills.update(bill.id, {
          sync_status: 'error',
          error_message: 'Server rejected bill',
        })
      }
    } catch {
      // Still offline — leave as pending
    }
  }
}
```

**Step 3: Commit**

```bash
git add app/api/pos/ lib/offline/sync.ts
git commit -m "feat: POS medicine sync endpoint and offline bill flush utility"
```

---

### Task 6.3: POS Billing Screen (Core Feature)

**Files:**
- Create: `app/(dashboard)/pos/page.tsx` (server shell)
- Create: `app/(dashboard)/pos/_components/pos-client.tsx` (client island)
- Create: `app/(dashboard)/pos/_components/medicine-search.tsx`
- Create: `app/(dashboard)/pos/_components/bill-line-items.tsx`
- Create: `app/(dashboard)/pos/_components/customer-form.tsx`
- Create: `app/(dashboard)/pos/_components/bill-totals.tsx`
- Create: `app/api/pos/bills/route.ts`

**Step 1: POS server page shell**

Create `app/(dashboard)/pos/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { PosClient } from './_components/pos-client'

export default async function POSPage() {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, name, branch_id')
    .single()

  return <PosClient userId={profile?.id} branchId={profile?.branch_id} />
}
```

**Step 2: POS client island (offline-capable)**

Create `app/(dashboard)/pos/_components/pos-client.tsx`:
```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { syncMedicines, flushOfflineBills } from '@/lib/offline/sync'
import { db, type OfflineMedicine } from '@/lib/offline/db'
import { MedicineSearch } from './medicine-search'
import { BillLineItems } from './bill-line-items'
import { CustomerForm } from './customer-form'
import { BillTotals } from './bill-totals'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { calculateBillTotals } from '@/lib/utils/billing'
import type { DiscountType } from '@/lib/types/database'

export interface BillItem {
  id: string  // local temp id
  medicine_id: string
  medicine_name: string
  stock_batch_id: string
  batch_no: string
  expiry_date: string
  available_qty: number
  qty: number
  sale_price: number
  discount_type: DiscountType
  discount_value: number
  tax: number
  price: number
}

interface PosClientProps {
  userId?: string
  branchId?: string
}

export function PosClient({ userId, branchId }: PosClientProps) {
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [items, setItems] = useState<BillItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [doctor, setDoctor] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'credit'>('cash')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  // Sync on mount
  useEffect(() => {
    setIsSyncing(true)
    syncMedicines().finally(() => setIsSyncing(false))

    const handleOnline = () => {
      setIsOnline(true)
      flushOfflineBills()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const totals = calculateBillTotals(
    items.map(item => ({
      subtotal: item.sale_price * item.qty,
      discount: item.discount_type === 'percent'
        ? item.sale_price * item.qty * (item.discount_value / 100)
        : item.discount_value,
      tax_amount: 0,  // computed in calculateLineItem
      price: item.price,
    }))
  )

  const handleSave = async () => {
    if (items.length === 0) {
      toast.error('Add at least one item to the bill')
      return
    }

    setSaving(true)
    const billData = {
      customer_name: customerName || null,
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      doctor: doctor || null,
      payment_method: paymentMethod,
      items: items.map(({ id, medicine_name, available_qty, ...item }) => item),
      ...totals,
      paid: totals.total,
      due: 0,
      note: note || null,
      bill_date: new Date().toISOString().split('T')[0],
    }

    if (isOnline) {
      try {
        const res = await fetch('/api/pos/bills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(billData),
        })
        const data = await res.json()
        if (res.ok) {
          toast.success(`Bill ${data.bill_no} saved successfully`)
          // Reset form
          setItems([])
          setCustomerName('')
          setCustomerPhone('')
          setCustomerEmail('')
          setDoctor('')
          setNote('')
          // Trigger print
          window.print()
        } else {
          toast.error(data.error ?? 'Failed to save bill')
        }
      } catch {
        // Network failed mid-save — queue offline
        await queueOffline(billData)
      }
    } else {
      await queueOffline(billData)
    }
    setSaving(false)
  }

  const queueOffline = async (billData: typeof billData) => {
    const { v4: uuidv4 } = await import('uuid')
    await db.offline_bills.add({
      id: uuidv4(),
      bill_data: billData,
      created_at: new Date().toISOString(),
      sync_status: 'pending',
    })
    toast.warning('Saved offline — will sync when internet returns')
    setItems([])
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New Bill</h1>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="flex items-center gap-1 text-green-600 text-sm">
              <Wifi className="w-4 h-4" /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-600 text-sm">
              <WifiOff className="w-4 h-4" /> Offline Mode
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => {
            setIsSyncing(true)
            syncMedicines().finally(() => setIsSyncing(false))
          }}>
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-card rounded-lg border p-4 space-y-4">
        <BillLineItems items={items} onItemsChange={setItems} />
        <BillTotals totals={totals} />
      </div>

      {/* Customer Info */}
      <CustomerForm
        name={customerName} onNameChange={setCustomerName}
        phone={customerPhone} onPhoneChange={setCustomerPhone}
        email={customerEmail} onEmailChange={setCustomerEmail}
        doctor={doctor} onDoctorChange={setDoctor}
        paymentMethod={paymentMethod} onPaymentMethodChange={setPaymentMethod}
        note={note} onNoteChange={setNote}
      />

      {/* Save */}
      <div className="flex justify-center">
        <Button onClick={handleSave} disabled={saving} size="lg" className="px-12">
          {saving ? 'Saving...' : 'Save Bill'}
        </Button>
      </div>
    </div>
  )
}
```

**Step 3: Medicine search with FEFO batch selection**

Create `app/(dashboard)/pos/_components/medicine-search.tsx`:
```typescript
'use client'

import { useState, useCallback } from 'react'
import { db } from '@/lib/offline/db'
import { Command, CommandInput, CommandList, CommandItem } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'
import type { BillItem } from './pos-client'
import { v4 as uuidv4 } from 'uuid'

interface MedicineSearchProps {
  onAddItem: (item: BillItem) => void
}

export function MedicineSearch({ onAddItem }: MedicineSearchProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])

  const handleSearch = useCallback(async (query: string) => {
    setSearch(query)
    if (query.length < 2) {
      setResults([])
      return
    }

    // Search IndexedDB (instant, offline-capable)
    const medicines = await db.medicines
      .filter(m =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        (m.company?.toLowerCase().includes(query.toLowerCase()) ?? false)
      )
      .limit(10)
      .toArray()

    setResults(medicines)
  }, [])

  const handleSelect = (medicine: any) => {
    // FEFO: pick batch with nearest expiry date that has stock
    const availableBatches = medicine.batches
      .filter((b: any) => b.available_qty > 0)
      .sort((a: any, b: any) =>
        new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
      )

    if (availableBatches.length === 0) {
      // Show error toast
      return
    }

    const fefo = availableBatches[0]

    const item: BillItem = {
      id: uuidv4(),
      medicine_id: medicine.id,
      medicine_name: medicine.name,
      stock_batch_id: fefo.id,
      batch_no: fefo.batch_no,
      expiry_date: fefo.expiry_date,
      available_qty: fefo.available_qty,
      qty: 1,
      sale_price: fefo.sale_price,
      discount_type: 'percent',
      discount_value: 0,
      tax: 0,
      price: fefo.sale_price,
    }

    onAddItem(item)
    setOpen(false)
    setSearch('')
    setResults([])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-muted-foreground">
          <Search className="w-4 h-4 mr-2" />
          Search medicine name...
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Type medicine name..."
            value={search}
            onValueChange={handleSearch}
          />
          <CommandList>
            {results.map(medicine => (
              <CommandItem
                key={medicine.id}
                onSelect={() => handleSelect(medicine)}
                className="cursor-pointer"
              >
                <div>
                  <div className="font-medium">{medicine.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {medicine.company} · {medicine.batches.filter((b: any) => b.available_qty > 0).length} batch(es) available
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

**Step 4: POS bill API route (online save)**

Create `app/api/pos/bills/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const data = await req.json()

  // Hard block: validate stock availability
  for (const item of data.items) {
    const { data: batch } = await supabase
      .from('stock_batches')
      .select('available_qty')
      .eq('id', item.stock_batch_id)
      .single()

    if (!batch || batch.available_qty < item.qty) {
      return NextResponse.json(
        { error: `Insufficient stock for batch ${item.batch_no}. Available: ${batch?.available_qty ?? 0}` },
        { status: 422 }
      )
    }
  }

  // Generate bill_no
  const { data: billNo } = await supabase.rpc('generate_bill_no')

  // Insert bill
  const { data: bill, error: billError } = await supabase
    .from('pos_bills')
    .insert({
      bill_no: billNo,
      customer_name: data.customer_name,
      customer_email: data.customer_email,
      customer_phone: data.customer_phone,
      doctor: data.doctor,
      payment_method: data.payment_method,
      subtotal: data.subtotal,
      discount_total: data.discount_total,
      tax_total: data.tax_total,
      total: data.total,
      paid: data.paid,
      due: data.due,
      note: data.note,
      bill_date: data.bill_date,
      status: 'saved',
    })
    .select('id, bill_no')
    .single()

  if (billError) {
    return NextResponse.json({ error: billError.message }, { status: 500 })
  }

  // Insert bill items
  await supabase.from('pos_bill_items').insert(
    data.items.map((item: any) => ({ ...item, bill_id: bill.id }))
  )

  // Deduct stock from batches
  for (const item of data.items) {
    await supabase
      .from('stock_batches')
      .update({
        sold_qty: supabase.rpc('increment', { x: item.qty }),
        available_qty: supabase.rpc('decrement', { x: item.qty }),
      })
      .eq('id', item.stock_batch_id)
  }

  return NextResponse.json({ bill_no: bill.bill_no, id: bill.id })
}
```

**Step 5: Commit**

```bash
git add app/(dashboard)/pos/ app/api/pos/
git commit -m "feat: offline-capable POS billing with IndexedDB sync, FEFO batch selection, hard stock block"
```

---

## Phase 7: Invoice (Credit Billing)

### Task 7.1: Invoice List and Form

**Files:**
- Create: `app/(dashboard)/invoices/page.tsx`
- Create: `app/(dashboard)/invoices/new/page.tsx`
- Create: `app/(dashboard)/invoices/actions.ts`
- Create: `components/invoices/invoice-form.tsx`
- Create: `components/invoices/invoice-pdf.tsx`

**Step 1: Invoice list with status filters**

Similar to POS bills list but with payment_status and invoice_status filter columns. Date range filter. Export PDF button per row.

**Step 2: Invoice form**

Invoice form differs from POS:
- Customer search/select (linked to customers table)
- Invoice Date + Due Date
- Payment Status (Paid/Partial/Unpaid) + Invoice Status (Draft/Sent/Paid)
- Line items are free-form (item_name + description, no batch tracking)
- Customer Note + Terms & Conditions fields

**Step 3: A4 Invoice PDF using @react-pdf/renderer**

Create `components/invoices/invoice-pdf.tsx`:
```typescript
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { Invoice } from '@/lib/types/database'
import { formatINR } from '@/lib/utils/currency'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1a1f3a' },
  table: { marginTop: 16 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f4f4f8', padding: 6 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', padding: 5 },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
})

interface InvoicePdfProps {
  invoice: Invoice
  storeName: string
  storeAddress: string
}

export function InvoicePDF({ invoice, storeName, storeAddress }: InvoicePdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{storeName}</Text>
            <Text>{storeAddress}</Text>
          </View>
          <View>
            <Text>Invoice: {invoice.invoice_no}</Text>
            <Text>Date: {invoice.invoice_date}</Text>
            {invoice.due_date && <Text>Due: {invoice.due_date}</Text>}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ flex: 3 }}>Item</Text>
            <Text style={{ flex: 1, textAlign: 'right' }}>Qty</Text>
            <Text style={{ flex: 1, textAlign: 'right' }}>Rate</Text>
            <Text style={{ flex: 1, textAlign: 'right' }}>Amount</Text>
          </View>
          {invoice.invoice_items?.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={{ flex: 3 }}>{item.item_name}</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>{item.qty}</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>{formatINR(item.unit_cost)}</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>{formatINR(item.price)}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 16, alignItems: 'flex-end' }}>
          <Text>Subtotal: {formatINR(invoice.subtotal)}</Text>
          <Text>Discount: -{formatINR(invoice.discount_total)}</Text>
          <Text>Tax: {formatINR(invoice.tax_total)}</Text>
          <Text style={{ fontWeight: 'bold', fontSize: 12 }}>Total: {formatINR(invoice.total)}</Text>
        </View>

        {invoice.customer_note && (
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontWeight: 'bold' }}>Note:</Text>
            <Text>{invoice.customer_note}</Text>
          </View>
        )}
      </Page>
    </Document>
  )
}
```

**Step 4: Commit**

```bash
git add app/(dashboard)/invoices/ components/invoices/
git commit -m "feat: credit invoice module with A4 PDF generation"
```

---

## Phase 8: Expenses, Salary & Accounts

### Task 8.1: Expenses

**Files:**
- Create: `app/(dashboard)/expenses/page.tsx`
- Create: `app/(dashboard)/expenses/new/page.tsx`
- Create: `app/(dashboard)/expenses/actions.ts`

**Step 1: Expense form fields**
Name, Expense Type (dropdown from distinct types), Amount, Method (Cash/UPI/Card), Date, Description.

Expense types to seed: Rent, Electricity, Salary, Coffee, Maintenance, Transport, Stock Write-off, Other.

**Step 2: Commit**

```bash
git add app/(dashboard)/expenses/
git commit -m "feat: expenses CRUD with type categorization"
```

---

### Task 8.2: Salary Records

Similar to expenses. Fields: Staff Name, Amount, Method, Date, Note.

```bash
git commit -m "feat: salary payment records module"
```

---

### Task 8.3: Accounts (Customer Ledger + Cash Book)

**Files:**
- Create: `app/(dashboard)/accounts/page.tsx`
- Create: `app/(dashboard)/accounts/customer-ledger/page.tsx`
- Create: `app/(dashboard)/accounts/cash-book/page.tsx`

**Customer Ledger:**
- List all customers with credit invoices
- Per customer: total invoiced, total paid, outstanding balance
- Record payment against a customer (creates customer_payments entry, updates invoice.paid + invoice.due)

**Cash Book:**
- Daily summary: Opening balance + Cash receipts (POS cash bills + Invoice cash payments) - Cash payments (cash purchases + cash expenses + cash salary) = Closing balance
- UPI/Card columns alongside cash for full daily reconciliation

**Step 4: Commit**

```bash
git add app/(dashboard)/accounts/
git commit -m "feat: accounts module with customer credit ledger and daily cash book"
```

---

## Phase 9: Reports (9 Types)

### Task 9.1: Reports Hub Page

**Files:**
- Create: `app/(dashboard)/reports/page.tsx`

The reports hub shows 9 cards. Each links to its dedicated report page.

```typescript
const reports = [
  { href: '/reports/pos-bill', title: 'POS/Bill Report', icon: ShoppingCart },
  { href: '/reports/invoice', title: 'Invoice Report', icon: FileText },
  { href: '/reports/purchase', title: 'Purchase Report', icon: ClipboardList },
  { href: '/reports/inventory', title: 'Inventory Report', icon: Archive },
  { href: '/reports/out-of-stock', title: 'Out of Stock Report', icon: AlertTriangle },
  { href: '/reports/expenses', title: 'Expenses Report', icon: DollarSign },
  { href: '/reports/salary', title: 'Salary Report', icon: Receipt },
  { href: '/reports/account', title: 'Account Report', icon: BookOpen },
  { href: '/reports/income-expense', title: 'Income & Expense Report', icon: BarChart3 },
]
```

### Task 9.2: Each Report (shared pattern)

**Every report page:**
- Date range filter (from / to)
- Optional secondary filter (customer, supplier, payment method, etc.)
- Paginated DataTable with column totals row
- Export CSV button (uses `URL.createObjectURL(new Blob([csvContent]))`)
- Export PDF button

**Implement these report queries:**

```typescript
// POS/Bill Report
SELECT pb.*, up.name as created_by_name
FROM pos_bills pb
LEFT JOIN user_profiles up ON pb.created_by = up.id
WHERE pb.bill_date BETWEEN :from AND :to
ORDER BY pb.bill_date DESC

// Inventory Report
SELECT m.name, m.company, sb.batch_no, sb.expiry_date,
  sb.purchase_price, sb.sale_price, sb.initial_qty,
  sb.sold_qty, sb.available_qty, sb.status
FROM stock_batches sb
JOIN medicines m ON sb.medicine_id = m.id
ORDER BY m.name

// Out of Stock Report
SELECT m.name, m.company, m.reorder_level,
  COALESCE(SUM(sb.available_qty), 0) as total_available
FROM medicines m
LEFT JOIN stock_batches sb ON m.id = sb.medicine_id AND sb.status = 'active'
GROUP BY m.id
HAVING total_available <= m.reorder_level

// Income & Expense Report
-- Income: SUM of pos_bills.total + invoices.total in period
-- Expenses: SUM of expenses.amount + salary.amount in period
-- Net: Income - Expenses
```

**Step 3: Commit**

```bash
git add app/(dashboard)/reports/
git commit -m "feat: reports hub with all 9 report types, CSV/PDF export"
```

---

## Phase 10: Dashboard

### Task 10.1: Dashboard KPIs & Charts

**Files:**
- Create: `app/(dashboard)/dashboard/page.tsx`
- Create: `components/dashboard/kpi-cards.tsx`
- Create: `components/dashboard/revenue-chart.tsx`
- Create: `components/dashboard/expense-chart.tsx`
- Create: `components/dashboard/stock-alerts.tsx`
- Create: `components/dashboard/notices-table.tsx`

**Step 1: Dashboard KPI data query**

```typescript
// All in a single Server Component — parallel fetching
const [todayRevenue, expenses, purchases, stockAlerts, notices] = await Promise.all([
  // Today's POS + Invoice revenue
  supabase.from('pos_bills')
    .select('total.sum()')
    .eq('bill_date', today),
  // This month's expenses
  supabase.from('expenses')
    .select('amount.sum()')
    .gte('date', startOfMonth),
  // This month's purchases
  supabase.from('purchases')
    .select('total.sum()')
    .gte('purchase_date', startOfMonth),
  // Low stock count
  supabase.rpc('get_low_stock_count'),
  // Active notices
  supabase.from('notices')
    .select('*')
    .eq('status', 'active')
    .lte('start_date', today)
    .gte('end_date', today),
])
```

**Step 2: Revenue chart (Recharts BarChart)**

```typescript
'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// Data: last 12 months, POS revenue vs Invoice revenue per month
```

**Step 3: Commit**

```bash
git add app/(dashboard)/dashboard/ components/dashboard/
git commit -m "feat: dashboard with KPI cards, 5 charts, stock alerts, and notices"
```

---

## Phase 11: System Settings

### Task 11.1: Settings Page

**Files:**
- Create: `app/(dashboard)/settings/page.tsx`
- Create: `app/(dashboard)/settings/actions.ts`
- Create: `lib/settings.ts`

**Settings stored in Supabase branches table (extended) or a system_settings table:**

```sql
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),
  store_name TEXT,
  store_legal_name TEXT,
  email TEXT,
  phone TEXT,
  logo_url TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  date_format TEXT DEFAULT 'DD/MM/YYYY',
  currency_code TEXT DEFAULT 'INR',
  currency_symbol TEXT DEFAULT '₹',
  invoice_prefix TEXT DEFAULT 'INV-',
  default_customer_note TEXT DEFAULT 'Once Goods Sold Can Not Be Taken Back',
  default_terms TEXT DEFAULT 'Please pay us your amount in 15 days.',
  invoice_template TEXT DEFAULT 'default',
  address TEXT,
  city TEXT,
  pincode TEXT
);
```

**Step 2: Settings form with tabbed layout (Basic Info + Address)**

**Step 3: Commit**

```bash
git add app/(dashboard)/settings/
git commit -m "feat: system settings with store info, localization, and invoice defaults"
```

---

## Phase 12: Data Migration Module

### Task 12.1: Migration Admin Tool

**Files:**
- Create: `app/(dashboard)/migration/page.tsx`
- Create: `app/api/migration/[entity]/route.ts`

**Step 1: Migration hub page**

Shows 10 migration cards (one per entity in dependency order):
1. Medicine Categories → `POST /api/migration/medicine-categories`
2. Medicines → `POST /api/migration/medicines`
3. Suppliers → `POST /api/migration/suppliers`
4. Customers → `POST /api/migration/customers`
5. Stock (current) → `POST /api/migration/stock-batches`
6. Purchases → `POST /api/migration/purchases`
7. POS Bills → `POST /api/migration/pos-bills`
8. Invoices → `POST /api/migration/invoices`
9. Expenses → `POST /api/migration/expenses`
10. Salary → `POST /api/migration/salary`

Each card:
- Shows: entity name, expected CSV columns, file upload input
- Upload → validate (show error rows preview) → confirm → import with progress
- Shows: imported count, error count

**Step 2: Generic migration API handler**

```typescript
// app/api/migration/[entity]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { migrationHandlers } from '@/lib/migration/handlers'

export async function POST(
  req: NextRequest,
  { params }: { params: { entity: string } }
) {
  const handler = migrationHandlers[params.entity]
  if (!handler) return NextResponse.json({ error: 'Unknown entity' }, { status: 400 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer)
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])

  return handler(rows)
}
```

**Step 3: Migration handlers per entity**

Create `lib/migration/handlers.ts` with CSV column → DB field mappings for each entity. Each handler validates rows and bulk inserts.

**Step 4: Commit**

```bash
git add app/(dashboard)/migration/ app/api/migration/ lib/migration/
git commit -m "feat: data migration module for full CSV import of all 10 entities"
```

---

## Phase 12 (Final): POS Bill List

### Task 12.2: POS Bill History

**Files:**
- Create: `app/(dashboard)/pos/bills/page.tsx`

The POS Bill list (seen in ref image 4.png):
- Date range filter
- Table: Bill No, Customer Name, Subtotal, Tax, Discount, Amount, Date, Actions
- View detail (print button) + Delete (admin/manager only)
- Pagination

```bash
git commit -m "feat: POS bill history list with date filter and print action"
```

---

## Final Checklist

```
[ ] All Supabase migrations applied
[ ] RLS policies tested for all 4 roles
[ ] POS offline mode tested (disable network in DevTools)
[ ] FEFO batch selection verified
[ ] Hard stock block verified (qty > available)
[ ] Thermal print CSS media query verified
[ ] A4 invoice PDF generation verified
[ ] All 9 reports generate correct data
[ ] CSV export works on all reports
[ ] Data migration tested with sample CSV
[ ] Dark mode verified across all pages
[ ] Mobile/tablet layout verified on POS screen
[ ] Offline bill sync verified (offline → create bill → come online → verify sync)
[ ] Bill number sequence starts from correct number (migration)
```

---

## Dependency Graph

```
Phase 0 (Setup) → ALL
Phase 1 (Auth) → ALL
Phase 2 (Medicines + Categories + Suppliers) → Phase 4, Phase 6
Phase 3 (Customers) → Phase 7
Phase 4 (Purchase) → Phase 5, Phase 6
Phase 5 (Stock) → Phase 6
Phase 6 (POS) → DONE ✓
Phase 7 (Invoice) → Phase 8, Phase 9
Phase 8 (Expenses + Salary + Accounts) → Phase 9, Phase 10
Phase 9 (Reports) → Phase 10
Phase 10 (Dashboard) → DONE ✓
Phase 11 (Settings) → Phase 6, Phase 7
Phase 12 (Migration) → ALL complete
```
