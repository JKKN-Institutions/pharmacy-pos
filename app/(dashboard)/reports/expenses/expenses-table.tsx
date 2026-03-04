'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { format } from 'date-fns'
import { formatINR } from '@/lib/utils/currency'

type ExpenseRow = {
  id: string
  date: string
  name: string
  expense_type: string
  amount: number
  method: string
  description: string | null
}

const methodColors: Record<string, string> = {
  cash: 'bg-green-100 text-green-700 dark:bg-green-900/30',
  upi: 'bg-green-100 text-green-700 dark:bg-green-900/30',
  card: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30',
  credit: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
}

const columns: ColumnDef<ExpenseRow>[] = [
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
    accessorKey: 'name',
    header: 'Expense Name',
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue('name')}</div>
    ),
  },
  {
    accessorKey: 'expense_type',
    header: 'Type',
    cell: ({ row }) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
        {row.getValue('expense_type')}
      </span>
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
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${methodColors[method] ?? 'bg-muted text-muted-foreground'}`}
        >
          {method}
        </span>
      )
    },
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground max-w-xs truncate">
        {row.getValue('description') || '—'}
      </div>
    ),
  },
]

export function ExpensesTable({ expenses }: { expenses: ExpenseRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={expenses}
      searchKey="name"
      searchPlaceholder="Search expense name..."
    />
  )
}
