'use client'

import React, { useState, useMemo, useCallback } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import {
  Search,
  FileSpreadsheet,
  FileText,
  Copy,
  Printer,
  ChevronLeft,
  ChevronRight,
  X,
  InboxIcon,
  ChevronDown,
  Download,
  CalendarIcon,
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

// ─── Export helper ────────────────────────────────────────────────────────────

function billsToExportRows(bills: PosBill[]) {
  return bills.map((b) => ({
    'Bill No': b.bill_no,
    Date: b.bill_date ? format(new Date(b.bill_date), 'dd MMM yyyy') : '',
    Customer: b.customer_name ?? 'Walk-in',
    Phone: b.customer_phone ?? '',
    'Payment Method': b.payment_method,
    Subtotal: b.subtotal,
    'Discount (₹)': b.discount_total,
    'Tax (₹)': b.tax_total,
    'Total (₹)': b.total,
    Status: b.status,
  }))
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BillsTable({ bills }: { bills: PosBill[] }) {
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [dateRange, setDateRange]         = useState<DateRange | undefined>(undefined)
  const [sorting, setSorting]             = useState<SortingState>([])

  // ─── Active filter state ──────────────────────────────────────────────────
  const hasFilters =
    !!search ||
    statusFilter !== 'all' ||
    paymentFilter !== 'all' ||
    !!dateRange?.from

  const dateLabel = useMemo(() => {
    if (!dateRange?.from) return null
    const f = format(dateRange.from, 'dd MMM yyyy')
    const t = dateRange.to ? format(dateRange.to, 'dd MMM yyyy') : null
    return t && t !== f ? `${f} – ${t}` : f
  }, [dateRange])

  // ─── Client-side filtering ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let data = bills
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(
        (b) =>
          b.bill_no.toLowerCase().includes(q) ||
          (b.customer_name ?? '').toLowerCase().includes(q) ||
          (b.customer_phone ?? '').includes(q)
      )
    }
    if (statusFilter !== 'all') {
      data = data.filter((b) => b.status === statusFilter)
    }
    if (paymentFilter !== 'all') {
      data = data.filter((b) => b.payment_method === paymentFilter)
    }
    if (dateRange?.from) {
      const fromStr = format(dateRange.from, 'yyyy-MM-dd')
      data = data.filter((b) => (b.bill_date ?? '') >= fromStr)
    }
    if (dateRange?.to) {
      const toStr = format(dateRange.to, 'yyyy-MM-dd')
      data = data.filter((b) => (b.bill_date ?? '') <= toStr)
    }
    return data
  }, [bills, search, statusFilter, paymentFilter, dateRange])

  const clearAll = () => {
    setSearch('')
    setStatusFilter('all')
    setPaymentFilter('all')
    setDateRange(undefined)
  }

  // ─── TanStack Table ───────────────────────────────────────────────────────
  const table = useReactTable({
    data: filtered,
    columns: billColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    initialState: { pagination: { pageSize: 15 } },
    state: { sorting },
  })

  const totalRows     = filtered.length
  const pageIndex     = table.getState().pagination.pageIndex
  const pageSize      = table.getState().pagination.pageSize
  const fromRow       = totalRows === 0 ? 0 : pageIndex * pageSize + 1
  const toRow         = Math.min((pageIndex + 1) * pageSize, totalRows)

  // ─── Excel export ─────────────────────────────────────────────────────────
  const exportToExcel = useCallback(() => {
    const rows = billsToExportRows(filtered)
    if (!rows.length) { toast.error('No data to export'); return }
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = Object.keys(rows[0]).map((k) => ({
      wch: Math.max(k.length, ...rows.map((r) => String((r as Record<string, unknown>)[k] ?? '').length)),
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Billing History')
    XLSX.writeFile(wb, `pos-bills-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
    toast.success(`${rows.length} bills exported to Excel`)
  }, [filtered])

  // ─── CSV export ───────────────────────────────────────────────────────────
  const exportToCSV = useCallback(() => {
    const rows = billsToExportRows(filtered)
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
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `pos-bills-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${rows.length} bills exported to CSV`)
  }, [filtered])

  // ─── Copy to clipboard ────────────────────────────────────────────────────
  const copyToClipboard = useCallback(async () => {
    const rows = billsToExportRows(filtered)
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
  }, [filtered])

  // ─── Print (table-only in new window) ────────────────────────────────────
  const printTable = useCallback(() => {
    if (!filtered.length) { toast.error('No data to print'); return }

    const grandTotal = formatINR(filtered.reduce((s, b) => s + (b.total ?? 0), 0))
    const rows = filtered.map((b, i) => `
      <tr style="background:${i % 2 === 1 ? '#fafafa' : '#fff'}">
        <td class="mono">${b.bill_no}</td>
        <td>${b.bill_date ? format(new Date(b.bill_date), 'dd MMM yyyy') : '—'}</td>
        <td>${b.customer_name ?? 'Walk-in'}</td>
        <td class="muted">${b.customer_phone ?? '—'}</td>
        <td class="cap">${b.payment_method}</td>
        <td class="right">${formatINR(b.subtotal)}</td>
        <td class="right red">${b.discount_total > 0 ? '-' + formatINR(b.discount_total) : '—'}</td>
        <td class="right muted">${b.tax_total > 0 ? formatINR(b.tax_total) : '—'}</td>
        <td class="right bold">${formatINR(b.total)}</td>
        <td class="cap">${b.status}</td>
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
  .bold{font-weight:700} .cap{text-transform:capitalize} .red{color:#ef4444} .muted{color:#6b7280}
  @media print{body{padding:0}}
</style></head>
<body>
  <div class="hdr">
    <h2>POS Billing History</h2>
    <p>Printed on ${format(new Date(), 'dd MMM yyyy, hh:mm a')} &middot; ${filtered.length} record${filtered.length !== 1 ? 's' : ''}${dateLabel ? ' &middot; ' + dateLabel : ''}</p>
  </div>
  <table>
    <thead><tr>
      <th>Bill No</th><th>Date</th><th>Customer</th><th>Phone</th>
      <th>Payment</th><th class="right">Subtotal</th><th class="right">Discount</th>
      <th class="right">Tax</th><th class="right">Total</th><th>Status</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="8">Grand Total (${filtered.length} bills)</td>
      <td class="right">${grandTotal}</td><td></td>
    </tr></tfoot>
  </table>
  <script>window.onload=function(){setTimeout(function(){window.print();window.close()},250)}</script>
</body></html>`

    const win = window.open('', '_blank', 'width=1100,height=800')
    if (win) { win.document.write(html); win.document.close() }
    else toast.error('Pop-up blocked — please allow pop-ups to print.')
  }, [filtered, dateLabel])

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Filter + Export toolbar ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search bill no / customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 w-60"
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

        {/* Status — shadcn Select */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36">
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

        {/* Payment — shadcn Select */}
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="h-9 w-36">
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

        {/* Date range — shadcn Popover + Calendar */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'h-9 w-60 justify-start gap-2 font-normal',
                !dateRange?.from && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="h-4 w-4 shrink-0" />
              <span className="truncate text-sm">
                {dateLabel ?? 'Pick date range'}
              </span>
              {dateRange?.from && (
                <X
                  className="ml-auto h-3.5 w-3.5 shrink-0 opacity-60 hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); setDateRange(undefined) }}
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
              captionLayout="dropdown"
            />
          </PopoverContent>
        </Popover>

        {/* Clear all filters */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}

        {/* Export — shadcn DropdownMenu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 ml-auto">
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={copyToClipboard} className="gap-2.5 cursor-pointer">
              <Copy className="h-4 w-4 text-muted-foreground" />
              Copy to clipboard
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={exportToCSV} className="gap-2.5 cursor-pointer">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToExcel} className="gap-2.5 cursor-pointer">
              <FileSpreadsheet className="h-4 w-4 text-green-600 dark:text-green-400" />
              Export as Excel
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={printTable} className="gap-2.5 cursor-pointer">
              <Printer className="h-4 w-4 text-muted-foreground" />
              Print
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border shadow-sm overflow-hidden bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-muted/60 hover:bg-muted/60 border-b-2 border-border">
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="font-semibold text-xs uppercase tracking-wider text-foreground/70 py-3 px-4 first:pl-6 last:pr-6"
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
                    <TableCell key={cell.id} className="py-3 px-4 first:pl-6 last:pr-6">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={billColumns.length} className="h-36 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <InboxIcon className="h-8 w-8 opacity-30" />
                    <span className="text-sm">No bills match the current filters</span>
                    {hasFilters && (
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

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          {totalRows === 0
            ? 'No records'
            : `Showing ${fromRow}–${toRow} of ${totalRows} record${totalRows !== 1 ? 's' : ''}`}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline" size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-3 py-1 rounded-md bg-muted">
            {pageIndex + 1} / {table.getPageCount() || 1}
          </span>
          <Button
            variant="outline" size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

    </div>
  )
}
