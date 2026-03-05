'use client'

import * as React from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatINR } from '@/lib/utils/currency'
import { format } from 'date-fns'
import { InboxIcon } from 'lucide-react'

// ─── Type ──────────────────────────────────────────────────────────────────────

export type PurchaseItem = {
  id:             string
  medicine_id:    string
  batch_no:       string | null
  expiry_date:    string | null
  packing_qty:    number | null
  quantity:       number | null
  total_qty:      number | null
  purchase_price: number | null
  sale_price:     number | null
  discount_value: number | null
  tax:            number | null
  price:          number | null
  medicines:      { name: string } | null
}

// ─── Styling constants (mirror AdvancedDataTable exactly) ──────────────────────

const TH = 'py-3 px-4 first:pl-6 last:pr-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap'
const TD = 'py-3 px-4 first:pl-6 last:pr-6'

// Columns that display right-aligned numeric values
const RIGHT_COLS = new Set([
  'packing_qty', 'quantity', 'purchase_price',
  'sale_price', 'discount_value', 'tax', 'price',
])

// ─── Column definitions ────────────────────────────────────────────────────────

const columns: ColumnDef<PurchaseItem>[] = [
  // Row number — derived from row.index, not from data
  {
    id: 'index',
    header: '#',
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">{row.index + 1}</span>
    ),
  },
  {
    id: 'name',
    header: 'Name',
    accessorFn: (row) => row.medicines?.name ?? row.medicine_id,
    cell: ({ getValue }) => (
      <span className="text-sm font-medium">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: 'batch_no',
    header: 'Batch No',
    cell: ({ getValue }) => (
      <span className="text-sm font-mono text-muted-foreground">
        {(getValue() as string | null) ?? '—'}
      </span>
    ),
  },
  {
    accessorKey: 'expiry_date',
    header: 'Expiry',
    cell: ({ getValue }) => {
      const v = getValue() as string | null
      return (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {v ? format(new Date(v), 'MM-yyyy') : '—'}
        </span>
      )
    },
  },
  {
    accessorKey: 'packing_qty',
    header: 'Pack Qty',
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums text-muted-foreground">
        {(getValue() as number | null) ?? '—'}
      </span>
    ),
  },
  {
    id: 'quantity',
    header: 'Quantity',
    accessorFn: (row) => row.total_qty ?? row.quantity,
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums font-medium">
        {(getValue() as number | null) ?? '—'}
      </span>
    ),
  },
  {
    accessorKey: 'purchase_price',
    header: 'Purchase Price',
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums">
        {formatINR((getValue() as number | null) ?? 0)}
      </span>
    ),
  },
  {
    accessorKey: 'sale_price',
    header: 'Sale Price',
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums">
        {formatINR((getValue() as number | null) ?? 0)}
      </span>
    ),
  },
  {
    accessorKey: 'discount_value',
    header: 'Discount',
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums text-muted-foreground">
        {formatINR((getValue() as number | null) ?? 0)}
      </span>
    ),
  },
  {
    accessorKey: 'tax',
    header: 'Tax',
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums text-muted-foreground">
        {formatINR((getValue() as number | null) ?? 0)}
      </span>
    ),
  },
  {
    accessorKey: 'price',
    header: 'Total',
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums font-semibold">
        {formatINR((getValue() as number | null) ?? 0)}
      </span>
    ),
  },
]

// ─── Component ─────────────────────────────────────────────────────────────────

interface Props {
  items: PurchaseItem[]
  subtotal?: number
  tax?: number
  discount?: number
  total?: number
}

export function PurchaseItemsTable({ items, subtotal, tax, discount, total }: Props) {
  const table = useReactTable({
    data:            items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  // Use header totals if provided, else compute from line items
  const displaySubtotal = subtotal ?? items.reduce((sum, i) => sum + (i.price ?? 0), 0)
  const displayTax      = tax ?? items.reduce((sum, i) => sum + (i.tax ?? 0), 0)
  const displayDiscount = discount ?? 0
  const displayTotal    = total ?? (displaySubtotal + displayTax - displayDiscount)
  const rows       = table.getRowModel().rows

  return (
    <div className="rounded-2xl border border-border shadow-sm overflow-hidden bg-white dark:bg-card">

      {/* ── Card toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <p className="text-sm font-semibold">Line Items</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {items.length} item{items.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-muted-foreground">
          <InboxIcon className="h-10 w-10 opacity-20" />
          <p className="text-sm font-medium">No line items recorded for this purchase.</p>
        </div>
      ) : (
        <>
          {/* ── Table ──────────────────────────────────────────────────────── */}
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
                        className={[
                          TH,
                          RIGHT_COLS.has(header.column.id) ? 'text-right' : '',
                        ].join(' ')}
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
                {rows.map((row, idx) => (
                  <TableRow
                    key={row.id}
                    className={[
                      'border-b border-border/40 transition-colors',
                      idx % 2 === 1
                        ? 'bg-muted/10 hover:bg-muted/30'
                        : 'bg-white dark:bg-card hover:bg-muted/20 dark:hover:bg-muted/30',
                    ].join(' ')}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={[
                          TD,
                          RIGHT_COLS.has(cell.column.id) ? 'text-right' : '',
                        ].join(' ')}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* ── Totals footer ────────────────────────────────────────────────── */}
          <div className="border-t border-border bg-muted/30 px-6 py-4">
            <div className="flex items-start justify-between">
              <span className="text-xs text-muted-foreground pt-1">
                {items.length} item{items.length !== 1 ? 's' : ''}
              </span>
              <div className="space-y-1.5 text-sm text-right">
                <div className="flex items-center justify-end gap-6">
                  <span className="text-muted-foreground">Sub Total</span>
                  <span className="tabular-nums w-28 text-right">{formatINR(displaySubtotal)}</span>
                </div>
                <div className="flex items-center justify-end gap-6">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="tabular-nums w-28 text-right">{formatINR(displayTax)}</span>
                </div>
                <div className="flex items-center justify-end gap-6">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="tabular-nums w-28 text-right">{formatINR(displayDiscount)}</span>
                </div>
                <div className="flex items-center justify-end gap-6 pt-1.5 border-t border-border">
                  <span className="font-semibold">Amount</span>
                  <span className="font-bold tabular-nums text-base w-28 text-right">{formatINR(displayTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
