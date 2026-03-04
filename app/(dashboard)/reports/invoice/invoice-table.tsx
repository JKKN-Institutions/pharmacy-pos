'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { format } from 'date-fns'
import { formatINR } from '@/lib/utils/currency'

type InvoiceRow = {
  id: string
  invoice_no: string
  invoice_date: string
  due_date: string | null
  total: number
  paid: number
  due: number
  payment_status: string
  customer_name: string
  customer_phone: string | null
}

const paymentStatusColors: Record<string, string> = {
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/30',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
  unpaid: 'bg-red-100 text-red-700 dark:bg-red-900/30',
}

const columns: ColumnDef<InvoiceRow>[] = [
  {
    accessorKey: 'invoice_no',
    header: 'Invoice No.',
    cell: ({ row }) => (
      <div className="font-mono font-medium">{row.getValue('invoice_no')}</div>
    ),
  },
  {
    accessorKey: 'customer_name',
    header: 'Customer',
    cell: ({ row }) => (
      <div>
        <div className="font-medium text-sm">{row.getValue('customer_name') || '—'}</div>
        {row.original.customer_phone && (
          <div className="text-xs text-muted-foreground">{row.original.customer_phone}</div>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'invoice_date',
    header: 'Date',
    cell: ({ row }) => (
      <div className="text-sm">
        {format(new Date(row.getValue('invoice_date')), 'dd MMM yyyy')}
      </div>
    ),
  },
  {
    accessorKey: 'due_date',
    header: 'Due Date',
    cell: ({ row }) => {
      const due = row.getValue('due_date') as string | null
      return (
        <div className="text-sm">
          {due ? format(new Date(due), 'dd MMM yyyy') : '—'}
        </div>
      )
    },
  },
  {
    accessorKey: 'total',
    header: 'Total',
    cell: ({ row }) => (
      <div className="font-semibold">{formatINR(row.getValue('total'))}</div>
    ),
  },
  {
    accessorKey: 'paid',
    header: 'Paid',
    cell: ({ row }) => (
      <div className="text-green-600 font-medium">{formatINR(row.getValue('paid'))}</div>
    ),
  },
  {
    accessorKey: 'due',
    header: 'Outstanding',
    cell: ({ row }) => {
      const due = row.getValue('due') as number
      return (
        <div className={due > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
          {formatINR(due)}
        </div>
      )
    },
  },
  {
    accessorKey: 'payment_status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('payment_status') as string
      return (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${paymentStatusColors[status] ?? 'bg-muted text-muted-foreground'}`}
        >
          {status}
        </span>
      )
    },
  },
]

export function InvoiceTable({ invoices }: { invoices: InvoiceRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={invoices}
      searchKey="invoice_no"
      searchPlaceholder="Search invoice number..."
    />
  )
}
