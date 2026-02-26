'use client'

import * as React from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  ColumnDef,
  OnChangeFn,
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import type { StockWithMedicine } from '@/app/(dashboard)/stock/columns'

const COLUMN_LABELS: Record<string, string> = {
  name:           'Name',
  batch_no:       'Batch',
  expiry_date:    'Expiry',
  purchase_price: 'Purchase Price',
  sale_price:     'Sale Price',
  initial_qty:    'Qty',
  sold_qty:       'Sold',
  available_qty:  'Available',
}

const PAGE_SIZE_OPTIONS = [10, 15, 25, 50] as const

interface StockDataTableProps {
  columns:          ColumnDef<StockWithMedicine>[]
  data:             StockWithMedicine[]
  totalCount:       number
  initialPage?:     number
  initialPageSize?: number
  initialSearch?:   string
  initialView?:     string
  initialSort?:     string
  initialOrder?:    'asc' | 'desc'
}

export function StockDataTable({
  columns,
  data,
  totalCount,
  initialPage     = 1,
  initialPageSize = 15,
  initialSearch   = '',
  initialView     = 'live',
  initialSort     = 'expiry_date',
  initialOrder    = 'asc',
}: StockDataTableProps) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [searchValue, setSearchValue] = React.useState(initialSearch)
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const [sorting, setSorting] = React.useState<SortingState>(
    initialSort ? [{ id: initialSort, desc: initialOrder === 'desc' }] : [],
  )

  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    purchase_price: false,
  })

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

  // ── View filter ─────────────────────────────────────────────────────────────
  const handleViewChange = (value: string) =>
    push({ view: value, page: '1' })

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
  const pageCount  = Math.max(1, Math.ceil(totalCount / initialPageSize))
  const canPrev    = initialPage > 1
  const canNext    = initialPage < pageCount
  const goToPage   = (p: number) => push({ page: String(p) })
  const handlePageSizeChange = (size: string) => push({ pageSize: size, page: '1' })

  // ── Clear all filters ───────────────────────────────────────────────────────
  const clearFilters = () => {
    setSearchValue('')
    push({ search: null, page: '1' })
  }

  const hasActiveFilters = !!initialSearch

  const rangeFrom = totalCount === 0 ? 0 : (initialPage - 1) * initialPageSize + 1
  const rangeTo   = Math.min(initialPage * initialPageSize, totalCount)

  // ── TanStack table instance ─────────────────────────────────────────────────
  const table = useReactTable({
    data,
    columns,
    manualPagination: true,
    manualSorting:    true,
    pageCount,
    getCoreRowModel:    getCoreRowModel(),
    getSortedRowModel:  getSortedRowModel(),
    onSortingChange:    handleSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnVisibility,
      pagination: { pageIndex: initialPage - 1, pageSize: initialPageSize },
    },
  })

  const rows = table.getRowModel().rows

  return (
    <div className="space-y-4">

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search medicine name…"
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

        {/* View filter */}
        <Select value={initialView} onValueChange={handleViewChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="live">Live Stock</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}

        {/* Right controls */}
        <div className="sm:ml-auto flex items-center gap-2">
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

      {/* ── Active filter chips ────────────────────────────────────────────── */}
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

      {/* ── Table ──────────────────────────────────────────────────────────── */}
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
                  className={[
                    'border-b border-border/40 transition-colors',
                    idx % 2 === 1 ? 'bg-muted/10 hover:bg-muted/30' : 'hover:bg-muted/30',
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
                      <p className="text-sm font-medium">No stock batches found</p>
                      {hasActiveFilters && (
                        <p className="text-xs mt-1">
                          Try adjusting your filters or{' '}
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

      {/* ── Pagination footer ──────────────────────────────────────────────── */}
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
              batch{totalCount !== 1 ? 'es' : ''}
              {hasActiveFilters && (
                <span className="text-muted-foreground/60"> (filtered)</span>
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
    </div>
  )
}
