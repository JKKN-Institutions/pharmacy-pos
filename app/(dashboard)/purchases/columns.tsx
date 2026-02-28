'use client'

import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Eye, Trash2 } from 'lucide-react'
import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deletePurchaseAction } from './actions'
import { toast } from 'sonner'
import { formatINR } from '@/lib/utils/currency'
import type { Purchase } from '@/lib/types/database'

type PurchaseWithSupplier = Purchase & { suppliers?: { name: string }; supplier_name?: string }

export const purchaseColumns: ColumnDef<PurchaseWithSupplier>[] = [
  {
    id: 'index',
    header: '#',
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground text-center w-8">{row.index + 1}</div>
    ),
  },
  {
    accessorKey: 'supplier_name',
    header: 'Supplier Name',
    cell: ({ row }) => (
      <Link
        href={`/purchases/${row.original.id}`}
        className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400 max-w-[200px] truncate block"
      >
        {row.original.suppliers?.name ?? (row.getValue('supplier_name') as string) ?? '—'}
      </Link>
    ),
  },
  {
    accessorKey: 'subtotal',
    header: () => <div className="text-right">Sub Total</div>,
    cell: ({ row }) => (
      <div className="text-sm text-right text-muted-foreground tabular-nums">
        {formatINR(row.getValue('subtotal'))}
      </div>
    ),
  },
  {
    accessorKey: 'tax',
    header: () => <div className="text-right">Tax</div>,
    cell: ({ row }) => (
      <div className="text-sm text-right text-muted-foreground tabular-nums">
        {formatINR(row.getValue('tax'))}
      </div>
    ),
  },
  {
    accessorKey: 'discount',
    header: () => <div className="text-right">Discount</div>,
    cell: ({ row }) => {
      const discount: number = row.getValue('discount')
      return (
        <div className="text-sm text-right tabular-nums">
          {discount > 0 ? (
            <span className="text-emerald-600 dark:text-emerald-400">
              −{formatINR(discount)}
            </span>
          ) : (
            <span className="text-muted-foreground">{formatINR(0)}</span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'total',
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => (
      <div className="text-sm font-semibold text-right tabular-nums">
        {formatINR(row.getValue('total'))}
      </div>
    ),
  },
  {
    accessorKey: 'purchase_date',
    header: 'Purchase Date',
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground whitespace-nowrap">
        {format(new Date(row.getValue('purchase_date')), 'dd/MM/yyyy')}
      </div>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const purchase = row.original
      return <PurchaseRowActions purchase={purchase} />
    },
  },
]

function PurchaseRowActions({ purchase }: { purchase: PurchaseWithSupplier }) {
  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/purchases/${purchase.id}`} className="flex items-center gap-2 cursor-pointer">
              <Eye className="h-4 w-4" />
              View
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        title="Delete purchase?"
        description="Deleting this purchase will remove the associated stock batches and cannot be undone."
        onConfirm={async () => {
          const result = await deletePurchaseAction(purchase.id)
          if (result?.error) toast.error(result.error)
          else toast.success('Purchase deleted')
        }}
      />
    </div>
  )
}
