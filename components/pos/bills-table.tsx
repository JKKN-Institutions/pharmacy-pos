'use client'

import React, { useState, useMemo, useCallback, useEffect, useTransition } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type PaginationState,
  type ColumnDef,
  type VisibilityState,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import {
  FileSpreadsheet,
  FileText,
  Copy,
  Printer,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  InboxIcon,
  ChevronDown,
  Download,
  CalendarIcon,
  Search,
  SlidersHorizontal,
  Loader2,
  Columns3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatINR } from '@/lib/utils/currency'
import type { PosBill } from '@/lib/types/database'
import { billColumns } from '@/app/(dashboard)/pos/bills/columns'
import { fetchBillsAction, type FetchBillsParams } from '@/app/(dashboard)/pos/bills/actions'

// ─── Export helpers ───────────────────────────────────────────────────────────

function billsToExportRows(bills: PosBill[]) {
  return bills.map((b) => ({
    'Bill No': b.bill_no,
    Date: b.bill_date ? format(new Date(b.bill_date), 'dd MMM yyyy') : '',
    Customer: b.customer_name ?? 'Walk-in',
    Phone: b.customer_phone ?? '',
    'Payment Method': b.payment_method,
    Status: b.status,
    Subtotal: b.subtotal,
    'Discount (₹)': b.discount_total,
    'Tax (₹)': b.tax_total,
    'Total (₹)': b.total,
  }))
}

// ─── Density config ───────────────────────────────────────────────────────────

type Density = 'compact' | 'normal' | 'comfortable'
const densityPadding: Record<Density, string> = {
  compact: 'py-1.5 px-3',
  normal: 'py-3 px-4',
  comfortable: 'py-4 px-5',
}

// Column label map for the visibility dropdown
const columnLabels: Record<string, string> = {
  bill_no: 'Bill #',
  customer_name: 'Customer',
  payment_method: 'Payment',
  subtotal: 'Subtotal',
  tax_total: 'Tax',
  discount_total: 'Discount',
  total: 'Amount',
  status: 'Status',
  bill_date: 'Date',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BillsTableProps {
  initialData: PosBill[]
  initialTotalCount: number
  onEditBill?: (bill: PosBill, items: any[]) => void
}

export function BillsTable({ initialData, initialTotalCount, onEditBill }: BillsTableProps) {
  // ── Server-side state ──
  const [data, setData] = useState<PosBill[]>(initialData)
  const [totalCount, setTotalCount] = useState(initialTotalCount)
  const [isPending, startTransition] = useTransition()

  // ── Filters ──
  const [search, setSearch]               = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter]   = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [dateRange, setDateRange]         = useState<DateRange | undefined>(undefined)

  // ── Table state ──
  const [sorting, setSorting]               = useState<SortingState>([{ id: 'created_at', desc: true }])
  const [pagination, setPagination]         = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [density, setDensity]               = useState<Density>('normal')

  const hasFilters = !!debouncedSearch || statusFilter !== 'all' || paymentFilter !== 'all' || !!dateRange?.from

  // ── Debounced search ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPagination(p => ({ ...p, pageIndex: 0 }))
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // ── Fetch data when params change ──
  useEffect(() => {
    const sortCol = sorting[0]?.id ?? 'created_at'
    const sortDir = sorting[0]?.desc === false ? 'asc' : 'desc'

    const params: FetchBillsParams = {
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      search: debouncedSearch || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      payment: paymentFilter !== 'all' ? paymentFilter : undefined,
      dateFrom: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
      dateTo: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined,
      sortBy: sortCol,
      sortOrder: sortDir,
    }

    startTransition(async () => {
      const result = await fetchBillsAction(params)
      setData(result.data as PosBill[])
      setTotalCount(result.totalCount)
    })
  }, [pagination.pageIndex, pagination.pageSize, debouncedSearch, statusFilter, paymentFilter, dateRange, sorting])

  const pageCount = Math.ceil(totalCount / pagination.pageSize)

  const dateLabel = useMemo(() => {
    if (!dateRange?.from) return null
    const f = format(dateRange.from, 'dd/MM/yyyy')
    const t = dateRange.to ? format(dateRange.to, 'dd/MM/yyyy') : null
    return t && t !== f ? `${f} – ${t}` : f
  }, [dateRange])

  const clearAll = useCallback(() => {
    setSearch('')
    setDebouncedSearch('')
    setStatusFilter('all')
    setPaymentFilter('all')
    setDateRange(undefined)
    setPagination(p => ({ ...p, pageIndex: 0 }))
  }, [])

  // ─── TanStack Table (manual mode) ──────────────────────────────────────────
  const table = useReactTable({
    data,
    columns: billColumns,
    pageCount,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: true,
    onSortingChange: (updater) => {
      setSorting(updater)
      setPagination(p => ({ ...p, pageIndex: 0 }))
    },
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setColumnVisibility,
    state: { sorting, pagination, columnVisibility },
    meta: { onEditBill },
  })

  const fromRow = totalCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1
  const toRow = Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalCount)

  // ─── Export (uses current page or fetches all filtered) ────────────────────
  const exportAll = useCallback(async () => {
    // Fetch all filtered rows for export (no pagination)
    const params: FetchBillsParams = {
      page: 0,
      pageSize: 100000,
      search: debouncedSearch || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      payment: paymentFilter !== 'all' ? paymentFilter : undefined,
      dateFrom: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
      dateTo: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined,
      sortBy: sorting[0]?.id ?? 'created_at',
      sortOrder: sorting[0]?.desc === false ? 'asc' : 'desc',
    }
    const result = await fetchBillsAction(params)
    return result.data as PosBill[]
  }, [debouncedSearch, statusFilter, paymentFilter, dateRange, sorting])

  const exportToExcel = useCallback(async () => {
    const allData = await exportAll()
    const rows = billsToExportRows(allData)
    if (!rows.length) { toast.error('No data to export'); return }
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = Object.keys(rows[0]).map((k) => ({
      wch: Math.max(k.length, ...rows.map((r) => String((r as Record<string, unknown>)[k] ?? '').length)),
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Billing History')
    XLSX.writeFile(wb, `pos-bills-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
    toast.success(`${rows.length} bills exported to Excel`)
  }, [exportAll])

  const exportToCSV = useCallback(async () => {
    const allData = await exportAll()
    const rows = billsToExportRows(allData)
    if (!rows.length) { toast.error('No data to export'); return }
    const headers = Object.keys(rows[0])
    const lines = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((h) => {
          const val = String((row as Record<string, unknown>)[h] ?? '')
          return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
        }).join(',')
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pos-bills-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${rows.length} bills exported to CSV`)
  }, [exportAll])

  const copyToClipboard = useCallback(async () => {
    const allData = await exportAll()
    const rows = billsToExportRows(allData)
    if (!rows.length) { toast.error('No data to copy'); return }
    const headers = Object.keys(rows[0])
    const lines = [
      headers.join('\t'),
      ...rows.map((row) =>
        headers.map((h) => String((row as Record<string, unknown>)[h] ?? '')).join('\t')
      ),
    ]
    await navigator.clipboard.writeText(lines.join('\n'))
    toast.success(`${rows.length} rows copied to clipboard`)
  }, [exportAll])

  const printTable = useCallback(async () => {
    const allData = await exportAll()
    if (!allData.length) { toast.error('No data to print'); return }
    const grandTotal = formatINR(allData.reduce((s, b) => s + (b.total ?? 0), 0))
    const rows = allData.map((b, i) => `
      <tr style="background:${i % 2 === 1 ? '#fafafa' : '#fff'}">
        <td class="mono">${b.bill_no}</td>
        <td>${b.bill_date ? format(new Date(b.bill_date), 'dd/MM/yyyy') : '—'}</td>
        <td>${b.customer_name ?? 'Walk-in'}</td>
        <td class="right">${formatINR(b.subtotal)}</td>
        <td class="right muted">${b.tax_total > 0 ? formatINR(b.tax_total) : '—'}</td>
        <td class="right red">${b.discount_total > 0 ? formatINR(b.discount_total) : '—'}</td>
        <td class="right bold">${formatINR(b.total)}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>POS Billing History</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#111;padding:24px}
  .hdr{margin-bottom:20px} .hdr h2{font-size:18px;font-weight:700} .hdr p{color:#6b7280;font-size:11px;margin-top:3px}
  table{width:100%;border-collapse:collapse}
  thead tr{background:#f9fafb;border-bottom:2px solid #e5e7eb}
  th{padding:9px 12px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#6b7280}
  td{padding:8px 12px;border-bottom:1px solid #f3f4f6}
  tfoot td{background:#f9fafb!important;border-top:2px solid #e5e7eb;font-weight:700}
  .mono{font-family:'Courier New',monospace;font-weight:600} .right{text-align:right}
  .bold{font-weight:700} .red{color:#ef4444} .muted{color:#6b7280}
  @media print{body{padding:0}}
</style></head>
<body>
  <div class="hdr">
    <h2>POS Billing History</h2>
    <p>Printed on ${format(new Date(), 'dd/MM/yyyy, hh:mm a')} &middot; ${allData.length} record${allData.length !== 1 ? 's' : ''}${dateLabel ? ' &middot; ' + dateLabel : ''}</p>
  </div>
  <table>
    <thead><tr>
      <th>#</th><th>Date</th><th>Name</th>
      <th class="right">Subtotal</th><th class="right">Tax</th>
      <th class="right">Discount</th><th class="right">Amount</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="6">Grand Total (${allData.length} bills)</td>
      <td class="right">${grandTotal}</td>
    </tr></tfoot>
  </table>
  <script>window.onload=function(){setTimeout(function(){window.print();window.close()},250)}</script>
</body></html>`

    const win = window.open('', '_blank', 'width=1000,height=700')
    if (win) { win.document.write(html); win.document.close() }
    else toast.error('Pop-up blocked — please allow pop-ups to print.')
  }, [exportAll, dateLabel])

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ══ Toolbar Row 1: Search + Column Visibility + Density + Export ══════ */}
      <div className="flex items-center gap-2">

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search bill#, customer, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 pr-8 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Page size */}
        <Select
          value={String(pagination.pageSize)}
          onValueChange={(v) => setPagination({ pageIndex: 0, pageSize: Number(v) })}
        >
          <SelectTrigger className="h-9 w-[70px] text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 15, 25, 50, 100].map((n) => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Column visibility toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 text-xs">
              <Columns3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Columns</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-xs">Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table.getAllLeafColumns()
              .filter(col => col.id !== 'actions')
              .map(col => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(v) => col.toggleVisibility(!!v)}
                  className="text-xs capitalize"
                >
                  {columnLabels[col.id] ?? col.id}
                </DropdownMenuCheckboxItem>
              ))
            }
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Density toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 text-xs">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">View</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuLabel className="text-xs">Row density</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(['compact', 'normal', 'comfortable'] as Density[]).map(d => (
              <DropdownMenuCheckboxItem
                key={d}
                checked={density === d}
                onCheckedChange={() => setDensity(d)}
                className="text-xs capitalize"
              >
                {d}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Export dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="hidden sm:inline h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={copyToClipboard} className="gap-2.5 cursor-pointer text-sm">
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              Copy to clipboard
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={exportToCSV} className="gap-2.5 cursor-pointer text-sm">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToExcel} className="gap-2.5 cursor-pointer text-sm">
              <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
              Export as Excel
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={printTable} className="gap-2.5 cursor-pointer text-sm">
              <Printer className="h-3.5 w-3.5 text-muted-foreground" />
              Print all
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ══ Filter Row 2: Status + Payment + Date Range + Reset ═══════════════ */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">

        {/* Status */}
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPagination(p => ({ ...p, pageIndex: 0 })) }}>
          <SelectTrigger className="h-8 w-full sm:w-[130px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="saved">Saved</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        {/* Payment */}
        <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setPagination(p => ({ ...p, pageIndex: 0 })) }}>
          <SelectTrigger className="h-8 w-full sm:w-[130px] text-xs">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="upi">UPI</SelectItem>
            <SelectItem value="card">Card</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
          </SelectContent>
        </Select>

        {/* Date range */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'h-8 px-3 gap-1.5 text-xs font-normal col-span-2 sm:col-span-1 justify-start sm:justify-center',
                !dateRange?.from && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{dateLabel ?? 'Date range'}</span>
              {dateRange?.from && (
                <X
                  className="ml-auto h-3 w-3 opacity-60 hover:opacity-100 shrink-0"
                  onClick={(e) => { e.stopPropagation(); setDateRange(undefined); setPagination(p => ({ ...p, pageIndex: 0 })) }}
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => { setDateRange(range); setPagination(p => ({ ...p, pageIndex: 0 })) }}
              numberOfMonths={1}
              disabled={{ after: new Date() }}
              captionLayout="dropdown"
            />
          </PopoverContent>
        </Popover>

        {/* Active filter count + reset */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground col-span-2 sm:col-span-1 w-full sm:w-auto"
          >
            <X className="h-3 w-3" />
            Reset filters
          </Button>
        )}

        {/* Loading indicator */}
        {isPending && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading...
          </div>
        )}
      </div>

      {/* ══ Data Table ════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-border shadow-sm overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="bg-muted/60 hover:bg-muted/60 border-b-2 border-border">
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn('first:pl-5 last:pr-5', densityPadding[density])}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
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
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row, idx) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      'border-b border-border/50 transition-colors hover:bg-primary/5',
                      idx % 2 === 1 ? 'bg-muted/20' : 'bg-card'
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn('first:pl-5 last:pr-5', densityPadding[density])}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-36 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <InboxIcon className="h-8 w-8 opacity-30" />
                      <span className="text-sm">
                        {isPending ? 'Loading bills...' : 'No bills match the current filters'}
                      </span>
                      {hasFilters && !isPending && (
                        <button onClick={clearAll} className="text-xs text-primary hover:underline">
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ══ Pagination ════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 text-sm text-muted-foreground">
        <span className="text-xs">
          {totalCount === 0
            ? 'No records found'
            : `Showing ${fromRow}–${toRow} of ${totalCount.toLocaleString()} entries`}
        </span>

        <div className="flex items-center gap-2">
          {/* Go to page input */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            <span>Go to</span>
            <Input
              type="number"
              min={1}
              max={pageCount || 1}
              defaultValue={pagination.pageIndex + 1}
              key={pagination.pageIndex}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = parseInt((e.target as HTMLInputElement).value)
                  if (val >= 1 && val <= pageCount) {
                    setPagination(p => ({ ...p, pageIndex: val - 1 }))
                  }
                }
              }}
              className="h-7 w-14 text-center text-xs"
            />
          </div>

          {/* Page navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="sm"
              onClick={() => setPagination(p => ({ ...p, pageIndex: 0 }))}
              disabled={pagination.pageIndex === 0 || isPending}
              className="h-8 w-8 p-0"
              title="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage() || isPending}
              className="h-8 w-8 p-0"
              title="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium px-3 py-1 rounded-md bg-muted text-foreground min-w-[60px] text-center">
              {pagination.pageIndex + 1} / {pageCount || 1}
            </span>
            <Button
              variant="outline" size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage() || isPending}
              className="h-8 w-8 p-0"
              title="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => setPagination(p => ({ ...p, pageIndex: pageCount - 1 }))}
              disabled={pagination.pageIndex >= pageCount - 1 || isPending}
              className="h-8 w-8 p-0"
              title="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

    </div>
  )
}
