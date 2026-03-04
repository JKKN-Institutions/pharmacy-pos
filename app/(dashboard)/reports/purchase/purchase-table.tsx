'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { format } from 'date-fns'
import { formatINR } from '@/lib/utils/currency'

type PurchaseRow = {
  id: string
  invoice_no: string
  purchase_date: string
  total: number
  status: string
  suppliers: { name: string } | null
}

const statusColors: Record<string, string> = {
  received: 'bg-green-100 text-green-700 dark:bg-green-900/30',
  returned: 'bg-red-100 text-red-700 dark:bg-red-900/30',
  partial_return: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
}

const columns: ColumnDef<PurchaseRow>[] = [
  {
    accessorKey: 'invoice_no',
    header: 'Invoice No.',
    cell: ({ row }) => (
      <div className="font-mono font-medium">{row.getValue('invoice_no')}</div>
    ),
  },
  {
    id: 'supplier',
    header: 'Supplier',
    cell: ({ row }) => (
      <div className="text-sm font-medium">{row.original.suppliers?.name ?? '—'}</div>
    ),
  },
  {
    accessorKey: 'purchase_date',
    header: 'Date',
    cell: ({ row }) => (
      <div className="text-sm">
        {format(new Date(row.getValue('purchase_date')), 'dd MMM yyyy')}
      </div>
    ),
  },
  {
    accessorKey: 'total',
    header: 'Total Cost',
    cell: ({ row }) => (
      <div className="font-semibold">{formatINR(row.getValue('total'))}</div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      const label =
        status === 'partial_return'
          ? 'Partial Return'
          : status.charAt(0).toUpperCase() + status.slice(1)
      return (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status] ?? 'bg-muted text-muted-foreground'}`}
        >
          {label}
        </span>
      )
    },
  },
]

export function PurchaseTable({ purchases }: { purchases: PurchaseRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={purchases}
      searchKey="invoice_no"
      searchPlaceholder="Search invoice number..."
    />
  )
}
