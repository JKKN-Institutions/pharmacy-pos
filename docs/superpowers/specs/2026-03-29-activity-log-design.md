# Activity Log Module — Design Spec

**Date:** 2026-03-29
**Status:** Approved
**Scope:** Admin-only activity log page — paginated table, full filters, CSV export, JSON details modal

---

## 1. Overview

A read-only module visible only to `admin` users that displays all entries in the `activity_logs` table. It lets the admin audit who did what, when, and on which record across the entire pharmacy system.

The `activity_logs` table already exists in Supabase. The `ActivityLog` TypeScript type is already defined in `lib/types/database.ts`. The `logActivity()` utility is at `lib/utils/activity-logger.ts`.

---

## 2. Architecture

### Files to create

| File | Purpose |
|------|---------|
| `app/(dashboard)/activity-logs/page.tsx` | Server Component — admin guard, data fetch, renders layout |
| `app/(dashboard)/activity-logs/actions.ts` | `'use server'` — CSV export action |
| `components/activity-logs/activity-log-filters.tsx` | `'use client'` — filter bar, updates URL search params |
| `components/activity-logs/activity-log-table.tsx` | `'use client'` — TanStack Table display |
| `components/activity-logs/activity-log-details-dialog.tsx` | `'use client'` — modal showing raw JSON `details` field |

### Files to modify

| File | Change |
|------|--------|
| `components/layout/sidebar.tsx` | Add "Activity Log" nav item in `AdminGroup` (admin only) |
| `components/bottom-nav/bottom-navbar.tsx` | Add "Activity Log" to admin settings group (admin only) |

---

## 3. Auth Guard

Follows the same pattern as `app/(dashboard)/users/page.tsx`:

```ts
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')

const { data: profile } = await supabase
  .from('user_profiles')
  .select('role')
  .eq('auth_user_id', user.id)
  .single()

if (profile?.role !== 'admin') redirect('/dashboard')
```

---

## 4. URL Search Params

All filters are URL query parameters. The page re-fetches from Supabase server-side on each navigation.

| Param | Type | Default | Purpose |
|-------|------|---------|---------|
| `search` | string | — | ilike filter on `user_name` |
| `action` | string | — | exact match on `action` column |
| `entity_type` | string | — | exact match on `entity_type` column |
| `date_from` | YYYY-MM-DD | — | `created_at >= date_from` |
| `date_to` | YYYY-MM-DD | — | `created_at <= date_to + 23:59:59` |
| `page` | number | 1 | Pagination page |
| `pageSize` | number | 20 | Rows per page (max 50) |
| `sort` | string | `created_at` | Sort column |
| `order` | `asc`/`desc` | `desc` | Sort direction |

---

## 5. Table Columns

| Column | Field | Display |
|--------|-------|---------|
| Date/Time | `created_at` | `dd/MM/yyyy HH:mm` |
| User | `user_name` | Plain text |
| Action | `action` | Colour-coded badge: CREATE=green, UPDATE=blue, DELETE=red, CANCEL=orange, LOGIN/LOGOUT=grey, EXPORT/IMPORT=purple |
| Entity Type | `entity_type` | Pill badge (muted) |
| Record | `entity_label` | Name of the affected record (e.g. "Paracetamol 500mg") |
| Details | `details` | "View" icon button — only shown when `details` is non-null; opens the details dialog |

---

## 6. Filter Bar (`activity-log-filters.tsx`)

A horizontal filter bar rendered above the table. Controls:

- **Search** — text input, filters by `user_name` (ilike)
- **Action** — `<Select>` dropdown with all `ActivityAction` values + "All"
- **Entity Type** — `<Select>` dropdown with all `ActivityEntityType` values + "All"
- **Date From / Date To** — two `<Input type="date">` pickers
- **Clear Filters** button — resets all params to default

On any filter change, the component calls `router.push()` with updated search params (resets `page` to 1).

---

## 7. Details Dialog (`activity-log-details-dialog.tsx`)

A shadcn/ui `<Dialog>` that opens when the user clicks "View" on a row with non-null `details`. Displays:

- Header: `{action} on {entity_type} — {entity_label}`
- Body: Pretty-printed JSON (`JSON.stringify(details, null, 2)`) in a `<pre>` block with monospace font and scroll

---

## 8. CSV Export (`actions.ts`)

A Server Action `exportActivityLogsAction(params)` that:

1. Accepts all filter params (same as page URL params)
2. Re-runs the Supabase query **without** `.range()` (no pagination limit)
3. Builds a CSV string: headers + one row per log entry
4. Returns the CSV string to the client

The client-side `<ExportButton>` component calls this action, receives the CSV string, creates a `Blob`, and triggers a browser download as `activity-log-YYYY-MM-DD.csv`.

Columns exported: `created_at`, `user_name`, `action`, `entity_type`, `entity_label`, `entity_id`, `details` (JSON stringified).

---

## 9. Navigation

### Sidebar (`sidebar.tsx`)

Add to `AdminGroup` under the existing "Users" link (admin role only):

```ts
{ href: '/activity-logs', icon: ScrollText, label: 'Activity Log', roles: ['admin'] }
```

Icon: `ScrollText` from `lucide-react`.

### Bottom Nav (`bottom-navbar.tsx`)

Add to the admin settings group (inside `userRole === 'admin'` block):

```ts
{
  href: '/activity-logs',
  label: 'Activity Log',
  icon: ScrollText,
  active: pathname.startsWith('/activity-logs'),
}
```

---

## 10. Data Flow

```
URL params
    ↓
page.tsx (Server Component)
    → admin guard
    → supabase query with filters + pagination
    → passes { logs, totalCount, filters } to client components
         ↓
    ActivityLogFilters (client) — reads/writes URL params
    ActivityLogTable   (client) — renders TanStack rows
         ↓ (on row "View" click)
    ActivityLogDetailsDialog (client) — shows JSON
         ↓ (on "Export CSV" click)
    exportActivityLogsAction (server action) → CSV download
```

---

## 11. Database Table (existing)

```
activity_logs
  id           uuid PK
  branch_id    uuid nullable
  user_id      uuid nullable
  user_name    text NOT NULL
  action       text NOT NULL
  entity_type  text NOT NULL
  entity_id    text nullable
  entity_label text nullable
  details      jsonb nullable
  created_at   timestamptz NOT NULL
```

No migration needed — table already exists in Supabase.

---

## 12. Out of Scope

- Writing activity log entries (the `logActivity()` utility handles that separately)
- Deleting or archiving log entries
- Real-time updates (no Supabase Realtime subscription)
- Role-based filtering (admin sees all branches' logs)
