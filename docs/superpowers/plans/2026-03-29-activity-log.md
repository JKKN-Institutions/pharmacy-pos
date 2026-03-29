# Activity Log Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only Activity Log page with paginated table, full filters (action, entity type, date range, user search), CSV export, and JSON details modal.

**Architecture:** Server Component page with URL-based filters following the existing `users/page.tsx` pattern. Uses `AdvancedDataTable` with `extraFilters` prop for filter controls. CSV export via Server Action. Details modal via shadcn Dialog.

**Tech Stack:** Next.js 16 Server Components, TanStack React Table (via AdvancedDataTable), shadcn/ui, Supabase, date-fns

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `components/activity-logs/activity-log-details-dialog.tsx` | Create | Client — modal showing raw JSON `details` |
| `components/activity-logs/activity-log-filters.tsx` | Create | Client — action + entity type selects + date filter |
| `components/activity-logs/columns.tsx` | Create | TanStack column definitions |
| `components/activity-logs/activity-log-table.tsx` | Create | Client — wraps AdvancedDataTable |
| `components/activity-logs/export-button.tsx` | Create | Client — CSV export trigger |
| `app/(dashboard)/activity-logs/actions.ts` | Create | Server Action — CSV export query |
| `app/(dashboard)/activity-logs/page.tsx` | Create | Server Component — admin guard + data fetch |
| `components/layout/sidebar.tsx` | Modify | Add "Activity Log" nav item (admin only) |
| `components/bottom-nav/bottom-navbar.tsx` | Modify | Add "Activity Log" to admin group |

---

### Task 1: Details Dialog Component

**Files:**
- Create: `components/activity-logs/activity-log-details-dialog.tsx`

- [ ] **Step 1: Create the details dialog component**

```tsx
'use client'

import { useState } from 'react'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ActivityLog } from '@/lib/types/database'

export function ActivityLogDetailsDialog({ log }: { log: ActivityLog }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => setOpen(true)}
        title="View details"
      >
        <Eye className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {log.action} &middot; {log.entity_type}
              {log.entity_label ? ` \u00b7 ${log.entity_label}` : ''}
            </DialogTitle>
          </DialogHeader>
          <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
            {JSON.stringify(log.details, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/activity-logs/activity-log-details-dialog.tsx
git commit -m "feat(activity-log): add details dialog component"
```

---

### Task 2: Column Definitions

**Files:**
- Create: `components/activity-logs/columns.tsx`

- [ ] **Step 1: Create the columns file**

```tsx
'use client'

import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import type { ActivityLog } from '@/lib/types/database'
import { ActivityLogDetailsDialog } from './activity-log-details-dialog'

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCEL: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  LOGIN:  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  LOGOUT: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  EXPORT: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  IMPORT: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

export const activityLogColumns: ColumnDef<ActivityLog>[] = [
  {
    accessorKey: 'created_at',
    header: 'Date / Time',
    cell: ({ row }) => (
      <span className="text-sm tabular-nums text-muted-foreground whitespace-nowrap">
        {format(new Date(row.getValue('created_at')), 'dd/MM/yyyy HH:mm')}
      </span>
    ),
  },
  {
    accessorKey: 'user_name',
    header: 'User',
    cell: ({ row }) => (
      <span className="text-sm font-medium">{row.getValue('user_name')}</span>
    ),
  },
  {
    accessorKey: 'action',
    header: 'Action',
    cell: ({ row }) => {
      const action = row.getValue('action') as string
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${actionColors[action] ?? 'bg-muted text-muted-foreground'}`}
        >
          {action}
        </span>
      )
    },
  },
  {
    accessorKey: 'entity_type',
    header: 'Entity',
    cell: ({ row }) => {
      const entity = row.getValue('entity_type') as string
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs font-medium capitalize">
          {entity.replace(/_/g, ' ')}
        </span>
      )
    },
  },
  {
    accessorKey: 'entity_label',
    header: 'Record',
    cell: ({ row }) => (
      <span className="text-sm max-w-[200px] truncate block">
        {(row.getValue('entity_label') as string | null) ?? '\u2014'}
      </span>
    ),
  },
  {
    id: 'details',
    header: '',
    cell: ({ row }) => {
      const log = row.original
      if (!log.details) return null
      return <ActivityLogDetailsDialog log={log} />
    },
  },
]
```

- [ ] **Step 2: Commit**

```bash
git add components/activity-logs/columns.tsx
git commit -m "feat(activity-log): add TanStack column definitions"
```

---

### Task 3: Filter Bar Component

**Files:**
- Create: `components/activity-logs/activity-log-filters.tsx`

- [ ] **Step 1: Create the filters component**

Uses the same URL-param-update pattern as `components/purchases/purchase-table-filters.tsx`, and reuses the existing `ReportDateFilter` for date range.

```tsx
'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ReportDateFilter } from '@/components/reports/report-date-filter'

const ACTION_OPTIONS = [
  'CREATE', 'UPDATE', 'DELETE', 'CANCEL',
  'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT',
]

const ENTITY_OPTIONS = [
  'medicine', 'purchase', 'pos_bill', 'invoice',
  'user', 'stock_batch', 'expense', 'salary',
  'customer', 'supplier', 'medicine_category', 'tax_rate',
]

interface ActivityLogFiltersProps {
  currentAction: string
  currentEntityType: string
}

export function ActivityLogFilters({
  currentAction,
  currentEntityType,
}: ActivityLogFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const update = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams.toString())
    if (!value || value === 'all') p.delete(key)
    else p.set(key, value)
    p.delete('page')
    router.replace(`${pathname}?${p.toString()}`)
  }

  return (
    <>
      <Select
        value={currentAction || 'all'}
        onValueChange={(v) => update('action', v)}
      >
        <SelectTrigger className="flex-1 min-w-[120px] sm:flex-none sm:w-[140px] h-9 text-sm">
          <SelectValue placeholder="All Actions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Actions</SelectItem>
          {ACTION_OPTIONS.map((a) => (
            <SelectItem key={a} value={a}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentEntityType || 'all'}
        onValueChange={(v) => update('entity_type', v)}
      >
        <SelectTrigger className="flex-1 min-w-[130px] sm:flex-none sm:w-[160px] h-9 text-sm">
          <SelectValue placeholder="All Entities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Entities</SelectItem>
          {ENTITY_OPTIONS.map((e) => (
            <SelectItem key={e} value={e} className="capitalize">
              {e.replace(/_/g, ' ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ReportDateFilter />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/activity-logs/activity-log-filters.tsx
git commit -m "feat(activity-log): add filter bar component"
```

---

### Task 4: Table Wrapper Component

**Files:**
- Create: `components/activity-logs/activity-log-table.tsx`

- [ ] **Step 1: Create the table wrapper**

Wraps `AdvancedDataTable`, passing columns and `ActivityLogFilters` as `extraFilters`. Same pattern as `app/(dashboard)/users/users-table.tsx`.

```tsx
'use client'

import { AdvancedDataTable } from '@/components/ui/advanced-data-table'
import { activityLogColumns } from './columns'
import { ActivityLogFilters } from './activity-log-filters'
import type { ActivityLog } from '@/lib/types/database'

interface ActivityLogTableProps {
  data: ActivityLog[]
  totalCount: number
  initialPage: number
  initialPageSize: number
  initialSearch: string
  initialSort: string
  initialOrder: 'asc' | 'desc'
  isFiltered: boolean
  currentAction: string
  currentEntityType: string
}

export function ActivityLogTable({
  data,
  totalCount,
  initialPage,
  initialPageSize,
  initialSearch,
  initialSort,
  initialOrder,
  isFiltered,
  currentAction,
  currentEntityType,
}: ActivityLogTableProps) {
  return (
    <AdvancedDataTable
      columns={activityLogColumns}
      data={data}
      totalCount={totalCount}
      initialPage={initialPage}
      initialPageSize={initialPageSize}
      initialSearch={initialSearch}
      initialSort={initialSort}
      initialOrder={initialOrder}
      searchPlaceholder="Search by user name\u2026"
      emptyMessage="No activity logs found"
      recordLabel="log"
      isFiltered={isFiltered}
      columnLabels={{
        created_at: 'Date / Time',
        user_name: 'User',
        action: 'Action',
        entity_type: 'Entity',
        entity_label: 'Record',
      }}
      extraFilters={
        <ActivityLogFilters
          currentAction={currentAction}
          currentEntityType={currentEntityType}
        />
      }
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/activity-logs/activity-log-table.tsx
git commit -m "feat(activity-log): add table wrapper component"
```

---

### Task 5: CSV Export Server Action + Export Button

**Files:**
- Create: `app/(dashboard)/activity-logs/actions.ts`
- Create: `components/activity-logs/export-button.tsx`

- [ ] **Step 1: Create the server action**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface ExportParams {
  search?: string
  action?: string
  entity_type?: string
  from?: string
  to?: string
}

export async function exportActivityLogsAction(
  params: ExportParams,
): Promise<{ csv: string } | { error: string }> {
  const supabase = await createClient()

  // Auth guard — admin only
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (profile?.role !== 'admin') return { error: 'Unauthorized' }

  // Build query — same filters as the page but without pagination
  let query = supabase
    .from('activity_logs')
    .select('created_at, user_name, action, entity_type, entity_label, entity_id, details')
    .order('created_at', { ascending: false })

  if (params.search) query = query.ilike('user_name', `%${params.search}%`)
  if (params.action) query = query.eq('action', params.action)
  if (params.entity_type) query = query.eq('entity_type', params.entity_type)
  if (params.from) query = query.gte('created_at', params.from)
  if (params.to) query = query.lte('created_at', `${params.to}T23:59:59`)

  const { data, error } = await query

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { csv: '' }

  // Build CSV
  const headers = [
    'Date/Time',
    'User',
    'Action',
    'Entity Type',
    'Record',
    'Entity ID',
    'Details',
  ]

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`

  const rows = data.map((row) =>
    [
      new Date(row.created_at).toLocaleString('en-IN'),
      row.user_name,
      row.action,
      row.entity_type,
      row.entity_label ?? '',
      row.entity_id ?? '',
      row.details ? JSON.stringify(row.details) : '',
    ]
      .map(String)
      .map(escape)
      .join(','),
  )

  return { csv: [headers.map(escape).join(','), ...rows].join('\n') }
}
```

- [ ] **Step 2: Create the export button client component**

```tsx
'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { exportActivityLogsAction } from '@/app/(dashboard)/activity-logs/actions'

export function ExportButton() {
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()

  async function handleExport() {
    setLoading(true)
    try {
      const result = await exportActivityLogsAction({
        search: searchParams.get('search') ?? undefined,
        action: searchParams.get('action') ?? undefined,
        entity_type: searchParams.get('entity_type') ?? undefined,
        from: searchParams.get('from') ?? undefined,
        to: searchParams.get('to') ?? undefined,
      })

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      if (!result.csv) {
        toast.info('No records to export')
        return
      }

      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      {loading ? (
        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
      ) : (
        <Download className="w-4 h-4 mr-1.5" />
      )}
      Export CSV
    </Button>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/activity-logs/actions.ts components/activity-logs/export-button.tsx
git commit -m "feat(activity-log): add CSV export action and button"
```

---

### Task 6: Server Component Page

**Files:**
- Create: `app/(dashboard)/activity-logs/page.tsx`

- [ ] **Step 1: Create the page**

Follows the exact pattern of `app/(dashboard)/users/page.tsx`: admin guard, URL params, paginated Supabase query.

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { ActivityLogTable } from '@/components/activity-logs/activity-log-table'
import { ExportButton } from '@/components/activity-logs/export-button'
import type { ActivityLog } from '@/lib/types/database'

const SORTABLE_COLUMNS = ['created_at', 'user_name', 'action', 'entity_type']

export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    action?: string
    entity_type?: string
    from?: string
    to?: string
    page?: string
    pageSize?: string
    sort?: string
    order?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // ── Auth guard — admin only ────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  // ── Pagination ─────────────────────────────────────────────────────────────
  const pageSize = Math.min(50, Math.max(10, parseInt(params.pageSize ?? '20')))
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const rangeFrom = (page - 1) * pageSize
  const rangeTo = rangeFrom + pageSize - 1

  // ── Sorting ────────────────────────────────────────────────────────────────
  const sortCol = SORTABLE_COLUMNS.includes(params.sort ?? '')
    ? params.sort!
    : 'created_at'
  const ascending = params.order === 'asc'

  // ── Query ──────────────────────────────────────────────────────────────────
  let query = supabase
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .order(sortCol, { ascending })
    .range(rangeFrom, rangeTo)

  if (params.search) query = query.ilike('user_name', `%${params.search}%`)
  if (params.action) query = query.eq('action', params.action)
  if (params.entity_type) query = query.eq('entity_type', params.entity_type)
  if (params.from) query = query.gte('created_at', params.from)
  if (params.to) query = query.lte('created_at', `${params.to}T23:59:59`)

  const { data: logs, count } = await query

  const isFiltered = !!(
    params.search ||
    params.action ||
    params.entity_type ||
    params.from ||
    params.to
  )

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-card rounded-2xl border shadow-sm p-5 sm:p-6 space-y-5">
        <PageHeader
          title="Activity Log"
          description="Audit trail of all system actions"
        >
          <ExportButton />
        </PageHeader>

        <ActivityLogTable
          data={(logs ?? []) as ActivityLog[]}
          totalCount={count ?? 0}
          initialPage={page}
          initialPageSize={pageSize}
          initialSearch={params.search ?? ''}
          initialSort={sortCol}
          initialOrder={ascending ? 'asc' : 'desc'}
          isFiltered={isFiltered}
          currentAction={params.action ?? ''}
          currentEntityType={params.entity_type ?? ''}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(dashboard)/activity-logs/page.tsx
git commit -m "feat(activity-log): add admin-only page with filters and pagination"
```

---

### Task 7: Add Navigation Items

**Files:**
- Modify: `components/layout/sidebar.tsx`
- Modify: `components/bottom-nav/bottom-navbar.tsx`

- [ ] **Step 1: Update sidebar.tsx**

Add `ScrollText` to the lucide-react import (line 29). Then add the Activity Log menu item inside `AdminGroup` (after the Users `SidebarMenuItem` block, around line 169):

```tsx
// Add to the lucide-react import:
import { ..., ScrollText } from 'lucide-react'

// Inside AdminGroup, after the Users SidebarMenuItem closing tag:
{showUsers && (
  <SidebarMenuItem>
    <SidebarMenuButton
      asChild
      isActive={pathname === '/activity-logs' || pathname.startsWith('/activity-logs/')}
      tooltip="Activity Log"
    >
      <Link href="/activity-logs">
        <NavItemIcon icon={ScrollText} />
        <span className="font-medium">Activity Log</span>
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
)}
```

- [ ] **Step 2: Update bottom-navbar.tsx**

Add `ScrollText` to the lucide-react import (line 14). Then add the Activity Log item in the Settings section, inside the first `if (userRole === 'admin')` block (around line 163, after the Users push):

```tsx
// Add to the lucide-react import:
import { ..., ScrollText } from 'lucide-react'

// After the Users push in the admin block:
adminMenus.push({
  href: '/activity-logs',
  label: 'Activity Log',
  icon: ScrollText,
  active: pathname.startsWith('/activity-logs'),
})
```

- [ ] **Step 3: Commit**

```bash
git add components/layout/sidebar.tsx components/bottom-nav/bottom-navbar.tsx
git commit -m "feat(activity-log): add navigation items to sidebar and bottom nav"
```

---

### Task 8: Verify Build

- [ ] **Step 1: Run build**

```bash
bun run build
```

Expected: Build succeeds with no TypeScript or lint errors.

- [ ] **Step 2: Run lint**

```bash
bun run lint
```

Expected: No new lint warnings or errors.

- [ ] **Step 3: Manual verification**

1. Open `/activity-logs` as admin — page loads with table
2. Open `/activity-logs` as non-admin — redirects to `/dashboard`
3. Filter by action, entity type, date range — table updates
4. Click "Export CSV" — downloads CSV with matching records
5. Click "View" on a row with details — dialog shows JSON
6. Sidebar shows "Activity Log" under Admin group
7. Bottom nav shows "Activity Log" in Settings group on mobile
