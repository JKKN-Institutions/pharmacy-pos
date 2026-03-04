'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { format } from 'date-fns'
import { formatINR } from '@/lib/utils/currency'
import type { PosBill } from '@/lib/types/database'

const columns: ColumnDef<PosBill>[] = [
  {
    accessorKey: 'bill_no',
    header: 'Bill No.',
    cell: ({ row }) => (
      <div className="font-mono font-medium">{row.getValue('bill_no')}</div>
    ),
  },
  {
    accessorKey: 'bill_date',
    header: 'Date',
    cell: ({ row }) => (
      <div className="text-sm">
        {format(new Date(row.getValue('bill_date')), 'dd MMM yyyy')}
      </div>
    ),
  },
  {
    accessorKey: 'customer_name',
    header: 'Customer',
    cell: ({ row }) => (
      <div className="text-sm">{row.getValue('customer_name') ?? 'Walk-in'}</div>
    ),
  },
  {
    accessorKey: 'payment_method',
    header: 'Method',
    cell: ({ row }) => (
      <div className="text-sm capitalize">{row.getValue('payment_method')}</div>
    ),
  },
  {
    accessorKey: 'total',
    header: 'Total',
    cell: ({ row }) => (
      <div className="font-semibold">{formatINR(row.getValue('total'))}</div>
    ),
  },
]

export function PosBillTable({ bills }: { bills: PosBill[] }) {
  return (
    <DataTable
      columns={columns}
      data={bills}
      searchKey="bill_no"
      searchPlaceholder="Search bill number..."
    />
  )
}
