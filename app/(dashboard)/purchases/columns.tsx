'use client'

import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Eye, Pencil } from 'lucide-react'
import Link from 'next/link'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deletePurchaseAction } from './actions'
import { toast } from 'sonner'
import { formatINR } from '@/lib/utils/currency'
import type { Purchase } from '@/lib/types/database'

type PurchaseWithSupplier = Purchase & { suppliers?: { name: string } }

export const purchaseColumns: ColumnDef<PurchaseWithSupplier>[] = [
  {
    accessorKey: 'invoice_no',
    header: 'Invoice No.',
    cell: ({ row }) => <div className="font-medium font-mono">{row.getValue('invoice_no')}</div>,
  },
  {
    id: 'supplier',
    header: 'Supplier',
    cell: ({ row }) => (
      <div className="text-sm">{row.original.suppliers?.name ?? '—'}</div>
    ),
  },
  {
    accessorKey: 'purchase_date',
    header: 'Date',
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground">
        {format(new Date(row.getValue('purchase_date')), 'dd MMM yyyy')}
      </div>
    ),
  },
  {
    accessorKey: 'total',
    header: 'Total',
    cell: ({ row }) => (
      <div className="font-semibold">{formatINR(row.getValue('total'))}</div>
    ),
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
