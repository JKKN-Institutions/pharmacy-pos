# Pharmacy POS System — Design Specification

**Date:** 2026-02-23
**Project:** pharmacy-pos
**Stack:** Next.js 16.1.6 · React 19.2.3 · Tailwind CSS v4 · shadcn/ui · Supabase · TypeScript
**Status:** Approved ✅

---

## 1. Project Overview

A full-featured pharmacy Point-of-Sale and management system for a retail pharmacy in India. The system replaces an existing application that has processed ~39,786 POS transactions and manages 9,861 stock batches across 2,018+ medicines.

### Core Goals
- Counter POS billing that works **offline** (PWA with IndexedDB sync queue)
- Complete inventory management with batch-level tracking and FEFO dispensing
- Credit/institutional invoice management
- Full data migration from existing system via CSV/Excel import
- Multi-role access (Admin, Manager, Pharmacist, Cashier)
- Fresh modern UI with dark mode support

---

## 2. Architecture Decision

**Hybrid Split Architecture (Approach C)**

```
┌─────────────────────────────────────────────────────────────┐
│                    PHARMACY POS SYSTEM                       │
├─────────────────────────────────────────────────────────────┤
│  SERVER-RENDERED MODULES (Next.js 16 Server Actions + SSR)  │
│  Dashboard, Medicines, Purchases, Invoices, Customers,      │
│  Suppliers, Expenses, Salary, Accounts, Stock, Reports,     │
│  Settings, User Management, Migration                       │
├─────────────────────────────────────────────────────────────┤
│  OFFLINE-CAPABLE PWA ISLAND (Client-side + IndexedDB)       │
│  POS/Billing — counter dispensing screen                    │
│  • Medicine catalog pre-loaded to IndexedDB                 │
│  • Bills queued locally when offline                        │
│  • Auto-syncs to Supabase when connectivity restored        │
│  • Service Worker caches POS page assets                    │
├─────────────────────────────────────────────────────────────┤
│  SHARED INFRASTRUCTURE                                      │
│  Supabase (PostgreSQL + Auth + Realtime + Storage)          │
│  4 Roles with RLS: Admin, Manager, Pharmacist, Cashier      │
│  PWA manifest + Service Worker                              │
│  next-themes (light/dark mode)                              │
│  Thermal print (ESC/POS via browser print API)              │
│  A4 PDF (@react-pdf/renderer for invoices)                  │
└─────────────────────────────────────────────────────────────┘
```

**Rationale:** The POS screen is used 50-100× per day and must be offline-capable. Admin screens handle sensitive financial data and benefit from SSR security. Splitting them gives the best of both worlds.

---

## 3. System Modules

| # | Module | Type | Priority |
|---|--------|------|----------|
| 1 | Auth & Role Management | SSR | P0 — Foundation |
| 2 | Medicine Catalog + Categories | SSR | P0 — Foundation |
| 3 | Suppliers | SSR | P0 — Foundation |
| 4 | Purchase Management | SSR | P1 — Core |
| 5 | Stock / Inventory | SSR | P1 — Core |
| 6 | POS / Billing (Offline PWA) | Client PWA | P1 — Core |
| 7 | Invoice (Credit Billing) | SSR | P1 — Core |
| 8 | Customers | SSR | P2 |
| 9 | Expenses + Salary | SSR | P2 |
| 10 | Accounts (Ledger + Cash Book) | SSR | P2 |
| 11 | Reports (9 types) | SSR | P2 |
| 12 | Dashboard | SSR | P3 |
| 13 | Settings + Data Migration | SSR | P3 |

---

## 4. Database Schema

### Core Tables

```sql
-- Future multi-branch support (single record for now)
branches (id, name, address, is_active)

-- User profiles linked to Supabase Auth
user_profiles (
  id, auth_user_id, name, email, phone,
  role ENUM(admin|manager|pharmacist|cashier),
  branch_id, is_active, created_at
)

-- Medicine master categories (34 categories: Cream, Tablet, Capsule, etc.)
medicine_categories (id, name, branch_id)

-- Medicine master catalog (2,018+ items)
medicines (
  id, name, aliases TEXT[],
  company, generic_name, category_id,
  unit, unit_packing, group,
  store_location,        -- physical shelf/drawer location
  min_level, reorder_level,
  status ENUM(active|inactive),
  branch_id, created_at, updated_at
)

-- Suppliers (VENUS AGENSY, SHREE AMMAN AGENCIES, etc.)
suppliers (
  id, name, contact_person, phone, email,
  address, city, pincode,
  branch_id, created_at
)

-- Customers (walk-in + credit)
customers (
  id, first_name, last_name, email, phone,
  blood_group, dob, gender,
  address_line1, address_line2, city, pincode,
  branch_id, created_at
)

-- THE inventory truth table — one row per batch
stock_batches (
  id, medicine_id, purchase_id,
  batch_no, expiry_date,
  purchase_price, sale_price,
  initial_qty, sold_qty,
  available_qty,         -- maintained: initial_qty - sold_qty
  status ENUM(active|expired|written_off),
  branch_id, created_at
)

-- Supplier purchase orders
purchases (
  id, supplier_id, invoice_no, purchase_date,
  subtotal, discount, tax, total,
  branch_id, created_by, created_at
)

-- Purchase line items
purchase_items (
  id, purchase_id, medicine_id,
  batch_no, expiry_date, packing_qty,
  quantity, total_qty,
  purchase_price, sale_price,
  discount_type ENUM(percent|flat), discount_value,
  tax, price
)

-- Counter cash sales (INV-XXXXX)
pos_bills (
  id, bill_no,            -- auto-generated INV-XXXXX
  customer_name, customer_email, customer_phone,
  doctor,                 -- free text, printed on bill only
  payment_method ENUM(cash|upi|card|credit),
  subtotal, discount_total, tax_total, total, paid, due,
  note, bill_date,
  status ENUM(saved|synced|sync_error),
  synced_at,
  branch_id, created_by, created_at
)

-- POS bill line items
pos_bill_items (
  id, bill_id, medicine_id, stock_batch_id,
  batch_no, expiry_date, qty,
  sale_price,
  discount_type ENUM(percent|flat), discount_value,
  tax, price
)

-- Credit/institutional invoices
invoices (
  id, invoice_no,
  customer_id,
  payment_method ENUM(cash|upi|card|credit),
  payment_status ENUM(paid|partial|unpaid),
  invoice_status ENUM(draft|sent|paid),
  invoice_date, due_date,
  subtotal, discount_total, tax_total, total, paid, due,
  customer_note, terms_conditions,
  branch_id, created_by, created_at
)

-- Invoice line items (no batch tracking needed)
invoice_items (
  id, invoice_id, item_name, item_description,
  qty, unit_cost,
  discount_type ENUM(percent|flat), discount_value,
  tax, price
)

-- Operational expenses
expenses (
  id, name, expense_type, amount,
  method ENUM(cash|upi|card),
  date, description,
  branch_id, created_by, created_at
)

-- Salary payment records (simple ledger)
salary_records (
  id, staff_name, amount,
  method ENUM(cash|upi|card),
  date, note,
  branch_id, created_by, created_at
)

-- Staff bulletin board
notices (
  id, title, description,
  start_date, end_date,
  status ENUM(active|inactive),
  branch_id, created_by
)

-- Customer credit payment tracking
customer_payments (
  id, customer_id, invoice_id,
  amount, method, date, note,
  branch_id, created_by
)
```

### IndexedDB Schema (Client-side, POS only)

```typescript
// idb-keyval / Dexie.js
offline_medicines: {
  id, name, aliases, company, sale_price, available_qty,
  batches: [{ batch_no, expiry_date, sale_price, available_qty }]
  last_synced_at
}

offline_bill_queue: {
  id: uuid,           // local ID
  bill_data: PosNewBillPayload,
  created_at: Date,
  sync_status: 'pending' | 'synced' | 'error',
  error_message?: string
}
```

---

## 5. User Roles & Permissions

| Module | Cashier | Pharmacist | Manager | Admin |
|--------|---------|------------|---------|-------|
| POS Billing | ✅ | ✅ | ✅ | ✅ |
| Invoice | ❌ | ✅ | ✅ | ✅ |
| Stock View | ❌ | ✅ | ✅ | ✅ |
| Purchase | ❌ | ✅ | ✅ | ✅ |
| Medicine Catalog | ❌ | ✅ | ✅ | ✅ |
| Customers | ❌ | ✅ | ✅ | ✅ |
| Expenses | ❌ | ❌ | ✅ | ✅ |
| Salary | ❌ | ❌ | ✅ | ✅ |
| Accounts | ❌ | ❌ | ✅ | ✅ |
| Reports | ❌ | ❌ | ✅ | ✅ |
| Dashboard | ❌ | ❌ | ✅ | ✅ |
| Users | ❌ | ❌ | ❌ | ✅ |
| Settings | ❌ | ❌ | ❌ | ✅ |
| Migration | ❌ | ❌ | ❌ | ✅ |

*Supabase RLS enforces these at the database level.*

---

## 6. Critical Workflows

### 6.1 POS Billing (Offline-Capable)

1. POS page loads → medicine catalog + stock batches synced to IndexedDB
2. Pharmacist searches medicine → instant client-side autocomplete (no network)
3. Medicine selected → auto-picks lowest expiry batch (FEFO)
   - Pre-fills: Batch No, Expiry Date, Available Qty, Sale Price
   - Pharmacist can click to override batch (picker shows all available batches)
4. Qty entered → if qty > available: **hard block** with toast error
5. Discount: toggle between `%` or `₹` per line item
6. Save bill:
   - **Online**: Server Action → insert bill + items → deduct stock batches → return bill_no
   - **Offline**: Save to IndexedDB queue → show "Saved Offline" indicator
   - **Background sync**: When online detected → flush queue → deduct stock
   - **Conflict**: If stock unavailable during sync → mark `sync_error` → notify
7. Post-save: Thermal print dialog opens automatically

### 6.2 Purchase → Stock

1. Select supplier + invoice no + date
2. Add line items: medicine must pre-exist in catalog
3. Each item: Batch No, Expiry, Packing Qty, Qty, Purchase Price, Sale Price, Discount, Tax
4. Save → **immediately** creates stock_batches rows + updates available_qty

### 6.3 Expired Stock Write-Off

1. Expire Stock tab → select batch → "Write Off"
2. Creates expense entry (type: "Stock Write-off", amount: purchase_price × available_qty)
3. Sets stock_batch.status = 'written_off', available_qty = 0

### 6.4 Invoice (Credit) Flow

1. Select/search customer → fill email, phone
2. Set payment method, invoice date, due date, status (Draft/Paid)
3. Add line items (free-form: item name, description — no batch tracking)
4. Save → customer account updated with outstanding balance
5. A4 PDF print available

---

## 7. Billing Calculation Engine

```
For each line item:
  if discount_type == 'percent':
    item_discount = sale_price × qty × (discount_value / 100)
  else:
    item_discount = discount_value

  item_tax = (sale_price × qty - item_discount) × (tax / 100)
  item_price = (sale_price × qty) - item_discount + item_tax

Bill totals:
  subtotal = sum(sale_price × qty)          -- before discounts
  discount_total = sum(item_discounts)
  tax_total = sum(item_taxes)
  total = subtotal - discount_total + tax_total
  due = total - paid
```

---

## 8. Print System

### POS Bills — Thermal Printer (58mm / 80mm)
- Browser `window.print()` with `@media print` CSS
- Thermal-optimized template: store name, bill no, date, item list, total, payment method
- Auto-triggered on bill save

### Invoices — A4 PDF
- `@react-pdf/renderer` generates PDF blob
- Supports multiple invoice templates (configurable in Settings)
- Download + print options

---

## 9. Dashboard KPIs & Charts

**Top KPI Cards (today vs yesterday comparison):**
- Total Revenue (POS + Invoice)
- Total Expenses
- Purchases Total
- Outstanding Dues

**Charts:**
1. Revenue trend (bar chart, last 12 months — POS + Invoice split)
2. Expense trend (line chart)
3. Expense by Type (donut chart)
4. Purchase trend (area chart)
5. Transaction count (line chart)

**Alert Widgets:**
- Low stock count (medicines below reorder level)
- Expiring soon count (expiring in 30 days)
- Pending customer dues

**Notices:** Bulletin board at bottom

---

## 10. Reports (9 Types)

| Report | Key Filters | Export |
|--------|-------------|--------|
| POS/Bill Report | Date range, payment method | CSV, PDF |
| Invoice Report | Date range, status, customer | CSV, PDF |
| Purchase Report | Date range, supplier | CSV, PDF |
| Inventory Report | Category, low stock filter | CSV, PDF |
| Out of Stock Report | Auto-generated | CSV, PDF |
| Expenses Report | Date range, type | CSV, PDF |
| Salary Report | Date range, staff | CSV, PDF |
| Account Report | Customer, date range | CSV, PDF |
| Income & Expense Report | Date range | CSV, PDF |

---

## 11. Data Migration Strategy

**Source:** CSV/Excel exports from existing system
**Target:** Supabase PostgreSQL via admin Migration module

**Migration sequence (order matters for FK integrity):**
1. medicine_categories
2. medicines
3. suppliers
4. customers
5. stock_batches (current live stock)
6. purchases (historical)
7. pos_bills + pos_bill_items (historical — 39,786+ bills)
8. invoices + invoice_items
9. expenses
10. salary_records

**Migration module features:**
- Upload CSV per entity
- Validate before import (show error rows)
- Preview first 20 rows
- Run import with progress bar
- Rollback per entity if needed

---

## 12. System Settings

- **Store Info:** Name, legal name, email, phone, logo, favicon
- **Localization:** Language (English), Timezone (IST), Date format (DD/MM/YYYY), Currency (₹ INR)
- **Invoice:** Invoice prefix (INV-), predefined customer note, predefined T&C, invoice templates
- **Address:** Store address

---

## 13. Technology Additions Needed

Beyond the current `package.json`, the following packages are required:

```json
{
  "@react-pdf/renderer": "^3.x",     // A4 invoice PDF
  "dexie": "^3.x",                   // IndexedDB wrapper (offline POS)
  "zustand": "^5.x",                 // POS client state
  "next-pwa": "^5.x",                // Service Worker / PWA manifest
  "@supabase/supabase-js": "^2.x",   // Supabase client
  "@supabase/ssr": "^0.x"            // Supabase SSR helpers for Next.js
}
```

---

## 14. Key Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Offline POS | IndexedDB + Service Worker | Hard requirement from user |
| Batch selection | Auto FEFO + override | Industry best practice |
| Tax | Mostly 0%, manual override | Pharmacy reality in India |
| Returns | Stock adjustment only | Rare, formal module overkill |
| Discount | Per-item % or ₹ toggle | Flexible for counter use |
| Overselling | Hard block | Stock integrity requirement |
| Doctor field | Free text only | No business logic, printed on bill |
| Multi-branch | branch_id in schema, single UI | Future-proof schema |
| Duration field | Optional legacy field | Not used, not prioritized |
| Print | Thermal (POS) + A4 PDF (Invoice) | Two workflows, two templates |
| Roles | 4-level RBAC via Supabase RLS | Real multi-user requirement |
| Migration | CSV → Supabase admin module | Existing export format |
| Devices | Desktop (admin) + Tablet (counter) | Mixed usage patterns |
| Language | English only | No i18n needed |
| Concurrent users | 4–10 (Supabase Pro + PgBouncer) | Medium pharmacy team |
