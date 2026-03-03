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
  Loader2,
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
import { bulkDeleteSuppliersAction } from '@/app/(dashboard)/suppliers/actions'
import type { Supplier } from '@/lib/types/database'

// Human-readable labels for the column-visibility toggle
const COLUMN_LABELS: Record<string, string> = {
  name: 'Supplier Name',
  contact_person: 'Contact Person',
  phone: 'Phone',
  email: 'Email',
  address: 'Address',
  city: 'City',
}

const PAGE_SIZE_OPTIONS = [10, 15, 25, 50] as const

interface SuppliersDataTableProps {
  columns: ColumnDef<Supplier>[]
  data: Supplier[]
  totalCount: number
  initialPage?: number
  initialPageSize?: number
  initialSearch?: string
  initialSort?: string
  initialOrder?: 'asc' | 'desc'
}

export function SuppliersDataTable({
  columns,
  data,
  totalCount,
  initialPage = 1,
  initialPageSize = 15,
  initialSearch = '',
  initialSort = '',
  initialOrder = 'asc',
}: SuppliersDataTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [searchValue, setSearchValue] = React.useState(initialSearch)
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const [sorting, setSorting] = React.useState<SortingState>(
    initialSort ? [{ id: initialSort, desc: initialOrder === 'desc' }] : [],
  )

  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    address: false,
  })

  // Row selection — keys are supplier UUIDs (from getRowId)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  // Bulk delete dialog & loading state
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false)

  // Reset selection on page change
  React.useEffect(() => {
    setRowSelection({})
  }, [initialPage])

  // ── URL helpers ────────────────────────────────────────────────────────────
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

  // ── Search (debounced) ─────────────────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearchValue(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      push({ search: value.trim() || null, page: '1' })
    }, 350)
  }

  // ── Server-side sorting ────────────────────────────────────────────────────
  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    setSorting(next)
    if (next.length > 0) {
      push({ sort: next[0].id, order: next[0].desc ? 'desc' : 'asc', page: '1' })
    } else {
      push({ sort: null, order: null, page: '1' })
    }
  }

  // ── Pagination helpers ─────────────────────────────────────────────────────
  const pageCount = Math.max(1, Math.ceil(totalCount / initialPageSize))
  const canPrev = initialPage > 1
  const canNext = initialPage < pageCount
  const goToPage = (p: number) => push({ page: String(p) })
  const handlePageSizeChange = (size: string) => push({ pageSize: size, page: '1' })

  // ── Clear filters ──────────────────────────────────────────────────────────
  const clearFilters = () => {
    setSearchValue('')
    router.replace(pathname)
  }

  const hasActiveFilters = !!initialSearch

  // ── Row range for footer ───────────────────────────────────────────────────
  const rangeFrom = totalCount === 0 ? 0 : (initialPage - 1) * initialPageSize + 1
  const rangeTo = Math.min(initialPage * initialPageSize, totalCount)

  // ── Bulk delete ────────────────────────────────────────────────────────────
  const selectedIds = Object.keys(rowSelection)
  const selectedCount = selectedIds.length

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true)
    const result = await bulkDeleteSuppliersAction(selectedIds)
    setIsBulkDeleting(false)
    setBulkDeleteOpen(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`${result.deleted} supplier${result.deleted !== 1 ? 's' : ''} deleted`)
      setRowSelection({})
    }
  }

  // ── TanStack table instance ────────────────────────────────────────────────
  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.id,
    enableRowSelection: true,
    manualPagination: true,
    manualSorting: true,
    pageCount,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: handleSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      pagination: {
        pageIndex: initialPage - 1,
        pageSize: initialPageSize,
      },
    },
  })

  const rows = table.getRowModel().rows

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">

        {/* Search — full width on mobile */}
        <div className="relative w-full sm:flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search suppliers…"
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-8"
          />
          {searchValue && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        )}

        {/* Right-side controls — full-width space-between on mobile, auto on desktop */}
        <div className="flex items-center gap-2 w-full justify-between sm:w-auto sm:ml-auto sm:justify-start">
          {/* Rows per page */}
          <Select value={String(initialPageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="w-[110px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Column visibility toggle */}
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
                    {COLUMN_LABELS[col.id] ?? col.id.replace(/_/g, ' ')}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Active filter chip ────────────────────────────────────────────── */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {initialSearch && (
            <Badge variant="secondary" className="gap-1.5 pl-2.5 pr-1.5 py-1 text-xs font-normal">
              Name: <span className="font-medium">{initialSearch}</span>
              <button
                onClick={() => handleSearchChange('')}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                aria-label="Remove search filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* ── Bulk action toolbar ───────────────────────────────────────────── */}
      {selectedCount > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-2.5 rounded-lg border border-primary/25 bg-primary/5 dark:bg-primary/10 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2.5">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected()
                  ? true
                  : table.getIsSomePageRowsSelected()
                    ? 'indeterminate'
                    : false
              }
              onCheckedChange={(v) => {
                if (!v) setRowSelection({})
                else table.toggleAllPageRowsSelected(true)
              }}
              aria-label="Toggle all rows"
            />
            <span className="text-sm font-medium">
              {selectedCount} of {data.length} selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-muted-foreground hover:text-foreground"
              onClick={() => setRowSelection({})}
            >
              Deselect all
            </Button>

            <div className="h-4 w-px bg-border hidden sm:block" />

            <Button
              size="sm"
              variant="destructive"
              className="h-8 gap-1.5"
              disabled={isBulkDeleting}
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete ({selectedCount})
            </Button>
          </div>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border shadow-sm overflow-hidden bg-card">
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
                      ? 'bg-primary/10 hover:bg-primary/15'
                      : idx % 2 === 1
                        ? 'bg-muted/10 hover:bg-muted/30'
                        : 'hover:bg-muted/30',
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
                <TableCell colSpan={columns.length} className="h-44 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <InboxIcon className="h-10 w-10 opacity-20" />
                    <div>
                      <p className="text-sm font-medium">No suppliers found</p>
                      {hasActiveFilters && (
                        <p className="text-xs mt-1">
                          Try adjusting your search or{' '}
                          <button
                            onClick={clearFilters}
                            className="underline underline-offset-2 hover:text-foreground transition-colors"
                          >
                            clear all
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

        <p className="text-sm text-muted-foreground order-2 sm:order-1">
          {totalCount === 0 ? (
            'No records'
          ) : (
            <>
              Showing{' '}
              <span className="font-medium text-foreground">{rangeFrom}–{rangeTo}</span>
              {' '}of{' '}
              <span className="font-medium text-foreground">{totalCount}</span>{' '}
              supplier{totalCount !== 1 ? 's' : ''}
              {hasActiveFilters && (
                <span className="text-muted-foreground/60"> (filtered)</span>
              )}
              {selectedCount > 0 && (
                <span className="ml-2 text-primary font-medium">
                  · {selectedCount} selected
                </span>
              )}
            </>
          )}
        </p>

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

      {/* ── Bulk delete confirmation ───────────────────────────────────────── */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedCount} supplier{selectedCount !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{' '}
              <span className="font-medium text-foreground">{selectedCount}</span>{' '}
              supplier{selectedCount !== 1 ? 's' : ''}. This may affect existing purchases
              linked to these suppliers and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isBulkDeleting}
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                `Delete ${selectedCount}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
