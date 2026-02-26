'use client'

import { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { formatINR } from '@/lib/utils/currency'
import type { StockBatch } from '@/lib/types/database'

export type StockWithMedicine = StockBatch & {
  medicines?: { name: string; company: string | null }
}

function ExpiryBadge({ date }: { date: string }) {
  const days = differenceInDays(new Date(date), new Date())
  return (
    <span
      className={cn(
        'text-sm font-medium',
        days < 0 && 'text-red-600 dark:text-red-400',
        days >= 0 && days <= 30 && 'text-amber-600 dark:text-amber-400',
        days > 30 && 'text-foreground',
      )}
    >
      {format(new Date(date), 'dd MMM yyyy')}
      {days < 0 && ' (Expired)'}
      {days >= 0 && days <= 30 && ` (${days}d left)`}
    </span>
  )
}

function SortHeader({ label, column }: { label: string; column: import('@tanstack/react-table').Column<StockWithMedicine> }) {
  return (
    <button
      className="flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {label}
      <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
    </button>
  )
}

export const stockColumns: ColumnDef<StockWithMedicine>[] = [
  // ── # ────────────────────────────────────────────────────────────────────────
  {
    id: 'row_number',
    header: '#',
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground tabular-nums">{row.index + 1}</span>
    ),
    enableSorting: false,
    enableHiding: false,
  },

  // ── Name ─────────────────────────────────────────────────────────────────────
  {
    id: 'name',
    accessorFn: (row) => row.medicines?.name ?? '',
    header: 'Name',
    cell: ({ row }) => (
      <div className="max-w-[220px]">
        <div className="font-medium text-sm truncate" title={row.original.medicines?.name ?? undefined}>
          {row.original.medicines?.name ?? '—'}
        </div>
        {row.original.medicines?.company && (
          <div className="text-xs text-muted-foreground truncate">{row.original.medicines.company}</div>
        )}
      </div>
    ),
    enableSorting: false,
  },

  // ── Batch ────────────────────────────────────────────────────────────────────
  {
    accessorKey: 'batch_no',
    header: 'Batch',
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.getValue('batch_no')}</span>
    ),
    enableSorting: false,
  },

  // ── Expiry ───────────────────────────────────────────────────────────────────
  {
    accessorKey: 'expiry_date',
    header: ({ column }) => <SortHeader label="Expiry" column={column} />,
    cell: ({ row }) => <ExpiryBadge date={row.getValue('expiry_date')} />,
  },

  // ── Purchase Price ───────────────────────────────────────────────────────────
  {
    accessorKey: 'purchase_price',
    header: ({ column }) => <SortHeader label="Purchase Price" column={column} />,
    cell: ({ row }) => (
      <span className="text-sm tabular-nums">{formatINR(row.getValue('purchase_price'))}</span>
    ),
  },

  // ── Sale Price ───────────────────────────────────────────────────────────────
  {
    accessorKey: 'sale_price',
    header: ({ column }) => <SortHeader label="Sale Price" column={column} />,
    cell: ({ row }) => (
      <span className="text-sm tabular-nums font-medium">{formatINR(row.getValue('sale_price'))}</span>
    ),
  },

  // ── Qty (initial) ─────────────────────────────────────────────────────────────
  {
    accessorKey: 'initial_qty',
    header: ({ column }) => <SortHeader label="Qty" column={column} />,
    cell: ({ row }) => (
      <span className="text-sm tabular-nums">{row.getValue('initial_qty')}</span>
    ),
  },

  // ── Sold ─────────────────────────────────────────────────────────────────────
  {
    accessorKey: 'sold_qty',
    header: ({ column }) => <SortHeader label="Sold" column={column} />,
    cell: ({ row }) => (
      <span className="text-sm tabular-nums text-muted-foreground">{row.getValue('sold_qty')}</span>
    ),
  },

  // ── Available ────────────────────────────────────────────────────────────────
  {
    accessorKey: 'available_qty',
    header: ({ column }) => <SortHeader label="Available" column={column} />,
    cell: ({ row }) => {
      const qty = row.getValue('available_qty') as number
      return (
        <span
          className={cn(
            'text-sm tabular-nums font-semibold',
            qty === 0 && 'text-red-600 dark:text-red-400',
            qty > 0 && qty <= 10 && 'text-amber-600 dark:text-amber-400',
            qty > 10 && 'text-emerald-600 dark:text-emerald-400',
          )}
        >
          {qty}
        </span>
      )
    },
  },
]
