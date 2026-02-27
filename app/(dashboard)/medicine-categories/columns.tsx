'use client'

import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { ArrowUpDown, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CategoryEditDialog } from '@/components/medicine-categories/category-form-dialog'
import {
  deleteCategoryAction,
  toggleCategoryStatusAction,
} from './actions'
import type { MedicineCategory } from '@/lib/types/database'

export type CategoryWithCount = MedicineCategory & { medicine_count: number }

// ── Row actions (named component to avoid re-render issues) ───────────────────

function CategoryRowActions({ category }: { category: CategoryWithCount }) {
  async function handleToggle() {
    const result = await toggleCategoryStatusAction(category.id, !category.is_active)
    if (result?.error) toast.error(result.error)
    else toast.success(category.is_active ? 'Category deactivated' : 'Category activated')
  }

  async function handleDelete() {
    const result = await deleteCategoryAction(category.id)
    if (result?.error) toast.error(result.error)
    else toast.success('Category deleted')
  }

  return (
    <div className="flex items-center gap-1">
      <CategoryEditDialog category={category} />
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={handleToggle}
        title={category.is_active ? 'Deactivate' : 'Activate'}
      >
        {category.is_active
          ? <ToggleRight className="h-4 w-4 text-emerald-500" />
          : <ToggleLeft  className="h-4 w-4" />
        }
      </Button>
      <ConfirmDialog
        title="Delete category?"
        description={`Delete "${category.name}"? Medicines using this category will lose their classification.`}
        onConfirm={handleDelete}
        trigger={
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        }
      />
    </div>
  )
}

// ── Column definitions ────────────────────────────────────────────────────────

export const categoryColumns: ColumnDef<CategoryWithCount>[] = [
  // Checkbox
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
            ? 'indeterminate'
            : false
        }
        onCheckedChange={v => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={v => row.toggleSelected(!!v)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },

  // Name + Description
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Category Name
        <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground/70" />
      </Button>
    ),
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-sm">{row.original.name}</p>
        {row.original.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {row.original.description}
          </p>
        )}
      </div>
    ),
  },

  // Medicines count
  {
    accessorKey: 'medicine_count',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Medicines
        <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground/70" />
      </Button>
    ),
    cell: ({ row }) => {
      const count = row.original.medicine_count
      return (
        <Badge variant="secondary" className="tabular-nums font-medium">
          {count}
        </Badge>
      )
    },
  },

  // Created date
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Created
        <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground/70" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {format(new Date(row.original.created_at), 'dd MMM yyyy')}
      </span>
    ),
  },

  // Actions
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => <CategoryRowActions category={row.original} />,
  },
]
