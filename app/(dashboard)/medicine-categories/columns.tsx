'use client'

import { ColumnDef } from '@tanstack/react-table'
import { MedicineCategory } from '@/lib/types/database'
import { format } from 'date-fns'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CategoryEditDialog } from '@/components/medicines/category-form-dialog'
import { deleteCategoryAction } from './actions'
import { toast } from 'sonner'

export const categoryColumns: ColumnDef<MedicineCategory>[] = [
  {
    accessorKey: 'name',
    header: 'Category Name',
    cell: ({ row }) => <div className="font-medium">{row.getValue('name')}</div>,
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground">
        {format(new Date(row.getValue('created_at')), 'dd MMM yyyy')}
      </div>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const category = row.original
      return (
        <div className="flex items-center gap-1">
          <CategoryEditDialog category={category} />
          <ConfirmDialog
            title="Delete category?"
            description={`Delete "${category.name}"? This may affect medicines using this category.`}
            onConfirm={async () => {
              const result = await deleteCategoryAction(category.id)
              if (result?.error) toast.error(result.error)
              else toast.success('Category deleted')
            }}
          />
        </div>
      )
    },
  },
]
