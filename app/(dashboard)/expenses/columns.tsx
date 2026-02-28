'use client'

import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ExpenseEditDialog } from '@/components/expenses/expense-form-dialog'
import { deleteExpenseAction } from './actions'
import { toast } from 'sonner'
import { formatINR } from '@/lib/utils/currency'
import type { Expense } from '@/lib/types/database'

const methodColors: Record<string, string> = {
  cash: 'bg-green-100 text-green-700',
  upi: 'bg-green-100 text-green-700',
  card: 'bg-purple-100 text-purple-700',
  credit: 'bg-amber-100 text-amber-700',
}

export const expenseColumns: ColumnDef<Expense>[] = [
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ row }) => (
      <div className="text-sm">{format(new Date(row.getValue("date")), "dd MMM yyyy")}</div>
    ),
  },
  {
    accessorKey: 'name',
    header: 'Expense Name',
    cell: ({ row }) => <div className="font-medium">{row.getValue('name')}</div>,
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
    cell: ({ row }) => <div className="font-semibold">{formatINR(row.getValue('amount'))}</div>,
  },
  {
    accessorKey: 'method',
    header: 'Method',
    cell: ({ row }) => {
      const method = row.getValue('method') as string
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${methodColors[method] ?? ""}`}>
          {method}
        </span>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const expense = row.original
      return (
        <div className="flex items-center gap-1">
          <ExpenseEditDialog expense={expense} />
          <ConfirmDialog
            title="Delete expense?"
            description={`Delete "${expense.name}"?`}
            onConfirm={async () => {
              const result = await deleteExpenseAction(expense.id)
              if (result?.error) toast.error(result.error)
              else toast.success('Expense deleted')
            }}
          />
        </div>
      )
    },
  },
]