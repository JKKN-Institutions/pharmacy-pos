# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Pharmacy POS** — A full-featured pharmacy Point-of-Sale and management system for a retail pharmacy in India (₹ INR currency). Rebuilding an existing system that has processed ~39,786 POS transactions across 2,018+ medicines and 9,861 stock batches.

Full design spec: `docs/plans/2026-02-23-pharmacy-pos-design.md`
Implementation plan: `docs/plans/2026-02-23-pharmacy-pos-implementation-plan.md`

## Commands

```bash
npm run dev       # Start dev server (Next.js 16 with Turbopack)
npm run build     # Production build
npm run lint      # ESLint
```

Add shadcn/ui components:
```bash
npx shadcn@latest add <component>   # e.g., npx shadcn@latest add table
```

Apply Supabase migrations:
```bash
# Use Supabase MCP tool: mcp__supabase__apply_migration
# Or via CLI: supabase db push
```

## Architecture

**Hybrid split** — two distinct rendering patterns in one app:

### 1. SSR Admin Modules (Next.js 16 Server Actions)
All management screens (medicines, purchases, invoices, reports, dashboard, settings) use the App Router with Server Components and Server Actions. Data fetches happen on the server via `lib/supabase/server.ts`.

Route group: `app/(dashboard)/` — protected by middleware, requires auth.

Pattern per module:
```
app/(dashboard)/<module>/
  page.tsx          ← Server Component (fetches data, renders table)
  new/page.tsx      ← Server Component (renders form)
  [id]/edit/page.tsx
  actions.ts        ← 'use server' — Zod validation + Supabase mutations
  columns.tsx       ← TanStack React Table column definitions
```

### 2. Offline-Capable POS Island (Client-side PWA)
`app/(dashboard)/pos/` is a **client-side island** — the only module that works without internet. Uses:
- **Dexie.js** (IndexedDB wrapper) at `lib/offline/db.ts` for local medicine catalog + bill queue
- **Zustand** for POS UI state
- **Service Worker** (next-pwa) to cache the POS page assets
- Sync API at `app/api/pos/sync/` syncs medicine catalog to IndexedDB on load
- Bill queue flushes to `app/api/pos/bills/` when connectivity returns

The POS client component (`'use client'`) handles all offline/online transitions. Never put POS data fetching in a Server Component.

### 3. Supabase
- Browser client: `lib/supabase/client.ts` — for client components only (POS island)
- Server client: `lib/supabase/server.ts` — for Server Components and Server Actions
- Auth middleware: `middleware.ts` + `lib/supabase/middleware.ts` — redirects unauthenticated to `/login`
- Migrations: `supabase/migrations/` — applied in order

## Key Design Decisions

**Two billing systems (not one):**
- `pos_bills` — cash counter sales, tracks batch/expiry per line item, works offline
- `invoices` — credit/institutional sales, has due dates, T&C, A4 PDF output

**Stock = two levels:**
- `medicines` table = master catalog (what the medicine is)
- `stock_batches` table = physical inventory (batch number, expiry, qty per purchase)
- Purchasing creates `stock_batches` rows immediately on save. No draft/approval step.

**FEFO batch selection:** When a medicine is added to a POS bill, the system auto-selects the batch with the nearest expiry date (`ORDER BY expiry_date ASC`). Pharmacist can override by picking a different batch from the picker. Stock is hard-blocked if `qty > available_qty`.

**4 user roles (Supabase RLS enforces these at DB level):**
- `cashier` — POS billing only
- `pharmacist` — POS + stock + purchases + medicines + customers
- `manager` — pharmacist permissions + expenses + salary + accounts + reports + dashboard
- `admin` — full access including users and settings

**Discount per line item:** `discount_type` is either `'percent'` or `'flat'` (₹). Both billing systems support this toggle. Billing math is in `lib/utils/billing.ts`.

**Print outputs:**
- POS bills → thermal receipt via `window.print()` with `@media print` CSS
- Invoices → A4 PDF via `@react-pdf/renderer`

## Database

All tables have `branch_id UUID` for future multi-branch support (single branch now). The sequence `pos_bill_seq` generates `INV-XXXXX` bill numbers via the `generate_bill_no()` Postgres function.

Critical indexes:
- `stock_batches(medicine_id, expiry_date, status)` — FEFO queries
- `medicines` GIN index on `to_tsvector('english', name)` — full-text search
- `pos_bills(bill_date, branch_id)` — date-range report queries

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6, React 19.2.3, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui ("new-york" style), lucide-react icons |
| Backend | Supabase (PostgreSQL + Auth + Storage + RLS) |
| Offline | Dexie.js (IndexedDB), next-pwa (Service Worker) |
| State | Zustand (POS client state only) |
| Forms | React Hook Form + Zod (all forms) |
| PDF | @react-pdf/renderer (A4 invoices) |
| Charts | Recharts (dashboard) |
| Toasts | Sonner |
| Tables | TanStack React Table (@tanstack/react-table) |

## File Path Conventions

```
lib/
  supabase/client.ts       ← Browser Supabase client
  supabase/server.ts       ← Server Supabase client (async, uses cookies())
  supabase/middleware.ts   ← Auth session refresh
  offline/db.ts            ← Dexie IndexedDB schema
  offline/sync.ts          ← Medicine sync + offline bill flush
  types/database.ts        ← All TypeScript interfaces matching DB tables
  utils/billing.ts         ← calculateLineItem(), calculateBillTotals()
  utils/currency.ts        ← formatINR(), formatINRCompact()
supabase/migrations/       ← SQL migration files (applied in order)
docs/plans/                ← Design spec and implementation plan
public/ref/                ← Reference screenshots of existing system (15 images)
```

## shadcn/ui Configuration

Style: `new-york`. CSS variables: enabled. Path aliases: `@/components/ui` for UI primitives, `@/components` for feature components.

## Common Gotchas

- **Never use `lib/supabase/server.ts` in a `'use client'` component** — it calls `cookies()` which is server-only. Use `lib/supabase/client.ts` instead.
- **Never put POS billing logic in Server Actions** — POS must work offline; Server Actions require network.
- **`available_qty` on `stock_batches` is maintained manually** — it is `initial_qty - sold_qty`. Always update both `sold_qty` and `available_qty` together when deducting stock.
- **Tailwind v4 syntax** — uses `@import "tailwindcss"` (not `@tailwind base/components/utilities`). CSS variables use `oklch()` color space.
- **Zod v4** is installed (`"zod": "^4.3.6"`). Use `z.coerce.number()` for form number fields. Import from `'zod'` directly.
