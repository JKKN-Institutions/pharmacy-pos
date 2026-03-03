'use client'

import * as React from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  ColumnDef,
  OnChangeFn,
  RowSelectionState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  InboxIcon,
  X,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100] as const

interface AdvancedDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  totalCount: number
  initialPage?: number
  initialPageSize?: number
  initialSearch?: string
  initialSort?: string
  initialOrder?: 'asc' | 'desc'
  searchPlaceholder?: string
  emptyMessage?: string
  /** Human-readable labels for column-visibility toggle (maps column id → label) */
  columnLabels?: Record<string, string>
  /** Additional filter elements rendered in the toolbar (e.g. status select) */
  extraFilters?: React.ReactNode
  /** Extra active-filter chips rendered below the toolbar */
  filterChips?: React.ReactNode
  /** Whether the result set is currently filtered (shows "filtered" hint in footer) */
  isFiltered?: boolean
  /** Label for the record type, e.g. "invoice", "customer" */
  recordLabel?: string
  /** Enable row selection checkboxes + bulk delete bar */
  enableRowSelection?: boolean
  /** Server Action called with selected IDs when bulk-delete is confirmed */
  bulkDeleteAction?: (ids: string[]) => Promise<{ deleted?: number; error?: string }>
}

export function AdvancedDataTable<TData, TValue>({
  columns,
  data,
  totalCount,
  initialPage = 1,
  initialPageSize = 15,
  initialSearch = '',
  initialSort = '',
  initialOrder = 'asc',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No records found',
  columnLabels = {},
  extraFilters,
  filterChips,
  isFiltered,
  recordLabel = 'record',
  enableRowSelection = false,
  bulkDeleteAction,
}: AdvancedDataTableProps<TData, TValue>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [searchValue, setSearchValue] = React.useState(initialSearch)
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const [sorting, setSorting] = React.useState<SortingState>(
    initialSort ? [{ id: initialSort, desc: initialOrder === 'desc' }] : [],
  )

  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})

  // ── Row selection state ─────────────────────────────────────────────────────
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  // Reset selection whenever the page changes
  React.useEffect(() => { setRowSelection({}) }, [initialPage])

  // ── Checkbox column (injected when enableRowSelection is true) ───────────────
  const allColumns = React.useMemo<ColumnDef<TData, TValue>[]>(() => {
    if (!enableRowSelection) return columns

    const checkboxCol: ColumnDef<TData, TValue> = {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
              ? 'indeterminate'
              : false
          }
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
          className="translate-y-px"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
          className="translate-y-px"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    }

    return [checkboxCol, ...columns]
  }, [columns, enableRowSelection])

  // ── URL helpers ─────────────────────────────────────────────────────────────
  const buildParams = React.useCallback(
    (overrides: Record<string, string | null>) => {
      const p = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(overrides)) {
        if (v === null || v === '') p.delete(k)
        else p.set(k, v)
      }
      return p.toString()
    },
    [searchParams],
  )

  const push = React.useCallback(
    (overrides: Record<string, string | null>) =>
      router.replace(`${pathname}?${buildParams(overrides)}`),
    [router, pathname, buildParams],
  )

  // ── Search (debounced) ──────────────────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearchValue(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      push({ search: value.trim() || null, page: '1' })
    }, 350)
  }

  const clearSearch = () => handleSearchChange('')

  // ── Server-side sorting ─────────────────────────────────────────────────────
  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    setSorting(next)
    if (next.length > 0) {
      push({ sort: next[0].id, order: next[0].desc ? 'desc' : 'asc', page: '1' })
    } else {
      push({ sort: null, order: null, page: '1' })
    }
  }

  // ── Pagination ──────────────────────────────────────────────────────────────
  const pageCount = Math.max(1, Math.ceil(totalCount / initialPageSize))
  const canPrev = initialPage > 1
  const canNext = initialPage < pageCount
  const goToPage = (p: number) => push({ page: String(p) })
  const handlePageSizeChange = (size: string) => push({ pageSize: size, page: '1' })

  const rangeFrom = totalCount === 0 ? 0 : (initialPage - 1) * initialPageSize + 1
  const rangeTo = Math.min(initialPage * initialPageSize, totalCount)

  const hasActiveSearch = !!initialSearch
  const showFilteredHint = isFiltered ?? hasActiveSearch

  // ── TanStack table ──────────────────────────────────────────────────────────
  const table = useReactTable({
    data,
    columns: allColumns,
    getRowId: (row) => (row as Record<string, string>).id ?? String(Math.random()),
    manualPagination: true,
    manualSorting: true,
    pageCount,
    enableRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: handleSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      pagination: { pageIndex: initialPage - 1, pageSize: initialPageSize },
    },
  })

  const rows = table.getRowModel().rows
  const selectedIds = Object.keys(rowSelection)
  const selectedCount = selectedIds.length

  // ── Bulk delete handler ────────────────────────────────────────────────────
  async function handleBulkDelete() {
    if (!bulkDeleteAction || !selectedIds.length) return
    setDeleting(true)
    const result = await bulkDeleteAction(selectedIds)
    setDeleting(false)
    setDeleteDialogOpen(false)
    if (result.error) {
      toast.error(`Delete failed: ${result.error}`)
    } else {
      toast.success(`${result.deleted ?? selectedCount} ${recordLabel}${(result.deleted ?? selectedCount) !== 1 ? 's' : ''} deleted`)
      setRowSelection({})
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">

      {/* ── Toolbar row ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">

        {/* Search — full width on mobile, flex-1 constrained on desktop */}
        <div className="relative w-full sm:flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-8"
          />
          {searchValue && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Module-specific extra filters — flex-wrap row on mobile, transparent on desktop */}
        {extraFilters && (
          <div className="flex flex-wrap gap-2 w-full sm:contents">
            {extraFilters}
          </div>
        )}

        {/* Right-side controls — full-width space-between on mobile, auto on desktop */}
        <div className="flex items-center gap-2 w-full justify-between sm:w-auto sm:ml-auto sm:justify-start">

          {/* Page size */}
          <Select value={String(initialPageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="w-[110px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Column visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
                Toggle columns
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((col) => col.getCanHide())
                .map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={col.getIsVisible()}
                    onCheckedChange={(v) => col.toggleVisibility(!!v)}
                    className="text-sm"
                  >
                    {columnLabels[col.id] ?? col.id.replace(/_/g, ' ')}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Active filter chips ───────────────────────────────────────────── */}
      {(hasActiveSearch || filterChips) && (
        <div className="flex flex-wrap gap-2">
          {hasActiveSearch && (
            <Badge
              variant="secondary"
              className="gap-1.5 pl-2.5 pr-1.5 py-1 text-xs font-normal"
            >
              Search: <span className="font-medium">{initialSearch}</span>
              <button
                onClick={clearSearch}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                aria-label="Remove search filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filterChips}
        </div>
      )}

      {/* ── Bulk action bar (visible when rows are selected) ─────────────── */}
      {enableRowSelection && selectedCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {selectedCount} {recordLabel}{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setRowSelection({})}
            >
              Clear
            </Button>
            {bulkDeleteAction && (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete {selectedCount}
                </Button>

                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Delete {selectedCount} {recordLabel}{selectedCount !== 1 ? 's' : ''}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the selected {recordLabel}
                        {selectedCount !== 1 ? 's' : ''} and all associated data.
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleBulkDelete}
                        disabled={deleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting ? 'Deleting…' : `Delete ${selectedCount}`}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border shadow-sm overflow-hidden bg-white dark:bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow
                  key={hg.id}
                  className="bg-muted/50 hover:bg-muted/50 border-b border-border"
                >
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="py-3 px-4 first:pl-6 last:pr-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((row, idx) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                    className={[
                      'border-b border-border/40 transition-colors',
                      row.getIsSelected()
                        ? 'bg-blue-50/60 dark:bg-blue-950/20'
                        : idx % 2 === 1
                        ? 'bg-muted/10 hover:bg-muted/30'
                        : 'bg-white dark:bg-card hover:bg-muted/20 dark:hover:bg-muted/30',
                    ].join(' ')}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3 px-4 first:pl-6 last:pr-6">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={allColumns.length} className="h-44 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <InboxIcon className="h-10 w-10 opacity-20" />
                      <div>
                        <p className="text-sm font-medium">{emptyMessage}</p>
                        {hasActiveSearch && (
                          <p className="text-xs mt-1">
                            Try adjusting your search or{' '}
                            <button
                              onClick={clearSearch}
                              className="underline underline-offset-2 hover:text-foreground transition-colors"
                            >
                              clear it
                            </button>
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Pagination footer ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">

        {/* Record count */}
        <p className="text-sm text-muted-foreground order-2 sm:order-1">
          {totalCount === 0 ? (
            'No records'
          ) : (
            <>
              Showing{' '}
              <span className="font-medium text-foreground">{rangeFrom}–{rangeTo}</span>
              {' '}of{' '}
              <span className="font-medium text-foreground">{totalCount}</span>{' '}
              {recordLabel}{totalCount !== 1 ? 's' : ''}
              {showFilteredHint && (
                <span className="text-muted-foreground/60"> (filtered)</span>
              )}
            </>
          )}
        </p>

        {/* Page navigation */}
        <div className="flex items-center gap-1 order-1 sm:order-2">
          <Button
            variant="outline" size="icon" className="h-8 w-8 hidden sm:flex"
            onClick={() => goToPage(1)} disabled={!canPrev} title="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            onClick={() => goToPage(initialPage - 1)} disabled={!canPrev} title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-3 py-1 rounded-md bg-muted min-w-[90px] text-center tabular-nums">
            {initialPage} / {pageCount}
          </span>
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            onClick={() => goToPage(initialPage + 1)} disabled={!canNext} title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline" size="icon" className="h-8 w-8 hidden sm:flex"
            onClick={() => goToPage(pageCount)} disabled={!canNext} title="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
