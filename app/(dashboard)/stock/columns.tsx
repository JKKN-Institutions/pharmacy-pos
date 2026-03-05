'use client'

import * as React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, MoreHorizontal, Eye, Pencil, PackagePlus } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatINR } from '@/lib/utils/currency'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { updateStockBatchAction } from './actions'
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

// ─── Row actions component ────────────────────────────────────────────────────
// Named component to keep React state stable across table re-renders

function StockRowActions({ batch }: { batch: StockWithMedicine }) {
  const [updateOpen, setUpdateOpen] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [availableQty, setAvailableQty] = React.useState(String(batch.available_qty))
  const [salePrice, setSalePrice] = React.useState(String(batch.sale_price))

  const handleUpdateStock = async () => {
    const qty = parseInt(availableQty, 10)
    const price = parseFloat(salePrice)

    if (isNaN(qty) || qty < 0) {
      toast.error('Enter a valid available quantity')
      return
    }
    if (isNaN(price) || price < 0) {
      toast.error('Enter a valid sale price')
      return
    }

    setIsSaving(true)
    const result = await updateStockBatchAction(batch.id, {
      available_qty: qty,
      sale_price: price,
    })
    setIsSaving(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Stock updated successfully')
      setUpdateOpen(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {batch.purchase_id && (
            <>
              <DropdownMenuItem asChild>
                <Link
                  href={`/purchases/${batch.purchase_id}`}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Eye className="h-4 w-4" />
                  Purchase View
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href={`/purchases/${batch.purchase_id}/edit`}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Pencil className="h-4 w-4" />
                  Purchase Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onSelect={() => {
              setAvailableQty(String(batch.available_qty))
              setSalePrice(String(batch.sale_price))
              setUpdateOpen(true)
            }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <PackagePlus className="h-4 w-4" />
            Update Stock
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Stock</DialogTitle>
            <DialogDescription>
              {batch.medicines?.name ?? 'Unknown'} &mdash; Batch {batch.batch_no}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 py-4">
            <div className="space-y-2">
              <Label htmlFor="available_qty">Available Qty</Label>
              <Input
                id="available_qty"
                type="number"
                min={0}
                max={batch.initial_qty}
                value={availableQty}
                onChange={(e) => setAvailableQty(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Initial: {batch.initial_qty} &bull; Sold: {batch.initial_qty - Number(availableQty) || batch.sold_qty}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale_price">Sale Price (₹)</Label>
              <Input
                id="sale_price"
                type="number"
                min={0}
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Purchase: {formatINR(batch.purchase_price)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStock} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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

  // ── Actions ────────────────────────────────────────────────────────────────────
  {
    id: 'actions',
    enableHiding: false,
    enableSorting: false,
    header: () => <div className="text-right pr-2">Actions</div>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <StockRowActions batch={row.original} />
      </div>
    ),
  },
]
