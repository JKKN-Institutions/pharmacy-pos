'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Supplier } from '@/lib/types/database'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SupplierEditDialog } from '@/components/suppliers/supplier-form-dialog'
import { deleteSupplierAction } from './actions'
import { toast } from 'sonner'

export const supplierColumns: ColumnDef<Supplier>[] = [
  {
    accessorKey: 'name',
    header: 'Supplier Name',
    cell: ({ row }) => <div className="font-medium">{row.getValue('name')}</div>,
  },
  {
    accessorKey: 'contact_person',
    header: 'Contact Person',
    cell: ({ row }) => <div className="text-sm">{row.getValue('contact_person') ?? '—'}</div>,
  },
  {
    accessorKey: 'phone',
    header: 'Phone',
    cell: ({ row }) => <div className="text-sm">{row.getValue('phone') ?? '—'}</div>,
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => <div className="text-sm text-muted-foreground">{row.getValue('email') ?? '—'}</div>,
  },
  {
    accessorKey: 'city',
    header: 'City',
    cell: ({ row }) => <div className="text-sm">{row.getValue('city') ?? '—'}</div>,
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const supplier = row.original
      return (
        <div className="flex items-center gap-1">
          <SupplierEditDialog supplier={supplier} />
          <ConfirmDialog
            title="Delete supplier?"
            description={`Delete "${supplier.name}"? This may affect existing purchases.`}
            onConfirm={async () => {
              const result = await deleteSupplierAction(supplier.id)
              if (result?.error) toast.error(result.error)
              else toast.success('Supplier deleted')
            }}
          />
        </div>
      )
    },
  },
]
