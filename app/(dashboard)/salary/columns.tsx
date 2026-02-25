'use client'

import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteSalaryAction } from './actions'
import { toast } from 'sonner'
import { formatINR } from '@/lib/utils/currency'
import type { SalaryRecord } from '@/lib/types/database'

export const salaryColumns: ColumnDef<SalaryRecord>[] = [
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ row }) => <div className="text-sm">{format(new Date(row.getValue("date")), "dd MMM yyyy")}</div>,
  },
  {
    accessorKey: 'staff_name',
    header: 'Staff Name',
    cell: ({ row }) => <div className="font-medium">{row.getValue('staff_name')}</div>,
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => <div className="font-semibold">{formatINR(row.getValue('amount'))}</div>,
  },
  {
    accessorKey: 'method',
    header: 'Method',
    cell: ({ row }) => <div className="text-sm capitalize">{row.getValue('method')}</div>,
  },
  {
    accessorKey: 'note',
    header: 'Note',
    cell: ({ row }) => <div className="text-sm text-muted-foreground">{row.getValue('note') ?? '—'}</div>,
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const record = row.original
      return (
        <ConfirmDialog
          title="Delete salary record?"
          description={`Delete salary record for ${record.staff_name}?`}
          onConfirm={async () => {
            const result = await deleteSalaryAction(record.id)
            if (result?.error) toast.error(result.error)
            else toast.success('Record deleted')
          }}
        />
      )
    },
  },
]