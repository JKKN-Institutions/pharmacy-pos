'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Customer } from '@/lib/types/database'
import { format } from 'date-fns'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CustomerEditDialog } from '@/components/customers/customer-form-dialog'
import { deleteCustomerAction } from './actions'
import { toast } from 'sonner'

export const customerColumns: ColumnDef<Customer>[] = [
  {
    accessorKey: 'first_name',
    header: 'Name',
    cell: ({ row }) => (
      <div className="font-medium">
        {row.original.first_name} {row.original.last_name ?? ''}
      </div>
    ),
  },
  {
    accessorKey: 'phone',
    header: 'Phone',
    cell: ({ row }) => <div className="text-sm font-mono">{row.getValue('phone')}</div>,
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => <div className="text-sm text-muted-foreground">{row.getValue('email') ?? '—'}</div>,
  },
  {
    accessorKey: 'blood_group',
    header: 'Blood Group',
    cell: ({ row }) => {
      const bg = row.getValue('blood_group') as string | null
      return bg ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {bg}
        </span>
      ) : <span className="text-muted-foreground text-sm">—</span>
    },
  },
  {
    accessorKey: 'gender',
    header: 'Gender',
    cell: ({ row }) => (
      <div className="text-sm capitalize">{row.getValue('gender') ?? '—'}</div>
    ),
  },
  {
    accessorKey: 'city',
    header: 'City',
    cell: ({ row }) => <div className="text-sm">{row.getValue('city') ?? '—'}</div>,
  },
  {
    accessorKey: 'created_at',
    header: 'Added',
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground">
        {format(new Date(row.getValue('created_at')), 'dd MMM yyyy')}
      </div>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const customer = row.original
      return (
        <div className="flex items-center gap-1">
          <CustomerEditDialog customer={customer} />
          <ConfirmDialog
            title="Delete customer?"
            description={`Delete ${customer.first_name} ${customer.last_name ?? ''}? This may affect existing invoices.`}
            onConfirm={async () => {
              const result = await deleteCustomerAction(customer.id)
              if (result?.error) toast.error(result.error)
              else toast.success('Customer deleted')
            }}
          />
        </div>
      )
    },
  },
]
