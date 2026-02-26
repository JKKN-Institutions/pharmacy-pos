'use client'

import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye } from 'lucide-react'
import Link from 'next/link'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deletePurchaseAction } from './actions'
import { toast } from 'sonner'
import { formatINR } from '@/lib/utils/currency'
import type { Purchase, PurchaseStatus } from '@/lib/types/database'

type PurchaseWithSupplier = Purchase & { suppliers?: { name: string } }

const statusStyles: Record<PurchaseStatus, string> = {
  received:
    'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  returned:
    'border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-950/40 dark:text-red-400',
  partial_return:
    'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
}

const statusLabel: Record<PurchaseStatus, string> = {
  received: 'Received',
  returned: 'Returned',
  partial_return: 'Partial Return',
}

export const purchaseColumns: ColumnDef<PurchaseWithSupplier>[] = [
  {
    accessorKey: 'invoice_no',
    header: 'Invoice No.',
    cell: ({ row }) => (
      <div className="font-medium font-mono text-sm">
        {row.getValue('invoice_no')}
      </div>
    ),
  },
  {
    id: 'supplier',
    header: 'Supplier',
    cell: ({ row }) => (
      <div className="text-sm font-medium max-w-[160px] truncate">
        {row.original.suppliers?.name ?? '—'}
      </div>
    ),
  },
  {
    accessorKey: 'purchase_date',
    header: 'Date',
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground whitespace-nowrap">
        {format(new Date(row.getValue('purchase_date')), 'dd MMM yyyy')}
      </div>
    ),
  },
  {
    accessorKey: 'subtotal',
    header: () => <div className="text-right">Sub Total</div>,
    cell: ({ row }) => (
      <div className="text-sm text-right text-muted-foreground">
        {formatINR(row.getValue('subtotal'))}
      </div>
    ),
  },
  {
    accessorKey: 'tax',
    header: () => <div className="text-right">Tax</div>,
    cell: ({ row }) => (
      <div className="text-sm text-right text-muted-foreground">
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
        <div className="text-sm text-right text-muted-foreground">
          {discount > 0 ? (
            <span className="text-emerald-600 dark:text-emerald-400">
              −{formatINR(discount)}
            </span>
          ) : (
            '—'
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'total',
    header: () => <div className="text-right">Total</div>,
    cell: ({ row }) => (
      <div className="text-sm font-semibold text-right">
        {formatINR(row.getValue('total'))}
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue<PurchaseStatus>('status')
      return (
        <Badge
          variant="outline"
          className={`text-xs whitespace-nowrap ${statusStyles[status] ?? ''}`}
        >
          {statusLabel[status] ?? status}
        </Badge>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const purchase = row.original
      return (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href={`/purchases/${purchase.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          <ConfirmDialog
            title="Delete purchase?"
            description="Deleting this purchase will remove the associated stock batches."
            onConfirm={async () => {
              const result = await deletePurchaseAction(purchase.id)
              if (result?.error) toast.error(result.error)
              else toast.success('Purchase deleted')
            }}
          />
        </div>
      )
    },
  },
]
