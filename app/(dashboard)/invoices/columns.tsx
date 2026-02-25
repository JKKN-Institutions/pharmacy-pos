'use client'

import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'
import Link from 'next/link'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteInvoiceAction } from './actions'
import { toast } from 'sonner'
import { formatINR } from '@/lib/utils/currency'
import type { Invoice } from '@/lib/types/database'

type InvoiceWithCustomer = Invoice & { customers?: { first_name: string; last_name: string | null; phone: string } }

const paymentColors: Record<string, string> = {
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/30',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
  unpaid: 'bg-red-100 text-red-700 dark:bg-red-900/30',
}

export const invoiceColumns: ColumnDef<InvoiceWithCustomer>[] = [
  {
    accessorKey: 'invoice_no',
    header: 'Invoice No.',
    cell: ({ row }) => <div className="font-mono font-medium">{row.getValue('invoice_no')}</div>,
  },
  {
    id: 'customer',
    header: 'Customer',
    cell: ({ row }) => (
      <div>
        <div className="font-medium text-sm">
          {row.original.customers ? `${row.original.customers.first_name} ${row.original.customers.last_name ?? ''}` : '—'}
        </div>
        {row.original.customers?.phone && (
          <div className="text-xs text-muted-foreground">{row.original.customers.phone}</div>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'invoice_date',
    header: 'Date',
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground">
        {format(new Date(row.getValue('invoice_date')), 'dd MMM yyyy')}
      </div>
    ),
  },
  {
    accessorKey: 'due_date',
    header: 'Due Date',
    cell: ({ row }) => {
      const due = row.getValue('due_date') as string | null
      return <div className="text-sm">{due ? format(new Date(due), 'dd MMM yyyy') : '—'}</div>
    },
  },
  {
    accessorKey: 'total',
    header: 'Total',
    cell: ({ row }) => <div className="font-semibold">{formatINR(row.getValue('total'))}</div>,
  },
  {
    accessorKey: 'due',
    header: 'Due Amt',
    cell: ({ row }) => {
      const due = row.getValue('due') as number
      return <div className={due > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>{formatINR(due)}</div>
    },
  },
  {
    accessorKey: 'payment_status',
    header: 'Payment',
    cell: ({ row }) => {
      const status = row.getValue('payment_status') as string
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${paymentColors[status] ?? ''}`}>
          {status}
        </span>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const invoice = row.original
      return (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href={`/invoices/${invoice.id}`}><Eye className="h-4 w-4" /></Link>
          </Button>
          <ConfirmDialog
            title="Delete invoice?"
            description="Delete this invoice permanently?"
            onConfirm={async () => {
              const result = await deleteInvoiceAction(invoice.id)
              if (result?.error) toast.error(result.error)
              else toast.success('Invoice deleted')
            }}
          />
        </div>
      )
    },
  },
]
