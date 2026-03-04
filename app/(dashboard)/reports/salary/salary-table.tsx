'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { format } from 'date-fns'
import { formatINR } from '@/lib/utils/currency'

type SalaryRow = {
  id: string
  date: string
  staff_name: string
  amount: number
  method: string
  note: string | null
}

const methodColors: Record<string, string> = {
  cash: 'bg-green-100 text-green-700 dark:bg-green-900/30',
  upi: 'bg-green-100 text-green-700 dark:bg-green-900/30',
  card: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30',
  bank_transfer: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30',
  credit: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
}

const columns: ColumnDef<SalaryRow>[] = [
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ row }) => (
      <div className="text-sm">
        {format(new Date(row.getValue('date')), 'dd MMM yyyy')}
      </div>
    ),
  },
  {
    accessorKey: 'staff_name',
    header: 'Staff Name',
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue('staff_name')}</div>
    ),
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => (
      <div className="font-semibold">{formatINR(row.getValue('amount'))}</div>
    ),
  },
  {
    accessorKey: 'method',
    header: 'Method',
    cell: ({ row }) => {
      const method = row.getValue('method') as string
      const label = method.replace('_', ' ')
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${methodColors[method] ?? 'bg-muted text-muted-foreground'}`}
        >
          {label}
        </span>
      )
    },
  },
  {
    accessorKey: 'note',
    header: 'Note',
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground">
        {row.getValue('note') || '—'}
      </div>
    ),
  },
]

export function SalaryTable({ records }: { records: SalaryRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={records}
      searchKey="staff_name"
      searchPlaceholder="Search staff name..."
    />
  )
}
