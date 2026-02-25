'use client'

import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'
import Link from 'next/link'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteBillAction } from './actions'
import { toast } from 'sonner'
import { formatINR } from '@/lib/utils/currency'
import type { PosBill } from '@/lib/types/database'

const statusStyles: Record<string, string> = {
  paid:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const methodStyles: Record<string, string> = {
  cash:   'bg-green-50 text-green-700 dark:bg-green-900/20',
  upi:    'bg-blue-50 text-blue-700 dark:bg-blue-900/20',
  card:   'bg-purple-50 text-purple-700 dark:bg-purple-900/20',
  credit: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20',
}

export const billColumns: ColumnDef<PosBill>[] = [
  {
    accessorKey: 'bill_no',
    header: 'Bill No.',
    cell: ({ row }) => (
      <div className="font-mono font-semibold text-sm">{row.getValue('bill_no')}</div>
    ),
  },
  {
    accessorKey: 'bill_date',
    header: 'Date',
    cell: ({ row }) => {
      const date = row.getValue('bill_date') as string
      return (
        <div className="text-sm text-muted-foreground">
          {format(new Date(date), 'dd MMM yyyy')}
        </div>
      )
    },
  },
  {
    accessorKey: 'customer_name',
    header: 'Customer',
    cell: ({ row }) => {
      const name = row.getValue('customer_name') as string | null
      const phone = row.original.customer_phone
      return (
        <div>
          <div className="font-medium text-sm">{name ?? 'Walk-in'}</div>
          {phone && <div className="text-xs text-muted-foreground">{phone}</div>}
        </div>
      )
    },
  },
  {
    accessorKey: 'payment_method',
    header: 'Payment',
    cell: ({ row }) => {
      const method = row.getValue('payment_method') as string
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${methodStyles[method] ?? ''}`}>
          {method}
        </span>
      )
    },
  },
  {
    accessorKey: 'total',
    header: 'Total',
    cell: ({ row }) => (
      <div className="font-semibold tabular-nums">
        {formatINR(row.getValue('total') as number)}
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusStyles[status] ?? ''}`}>
          {status}
        </span>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const bill = row.original
      return (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="View POS" asChild>
            <Link href="/pos">
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          <ConfirmDialog
            title="Delete bill?"
            description={`Permanently delete bill ${bill.bill_no}? This cannot be undone.`}
            onConfirm={async () => {
              const result = await deleteBillAction(bill.id)
              if (result?.error) toast.error(result.error)
              else toast.success(`Bill ${bill.bill_no} deleted`)
            }}
          />
        </div>
      )
    },
  },
]
