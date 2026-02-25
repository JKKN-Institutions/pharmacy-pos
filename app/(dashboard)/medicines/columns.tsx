'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, ArrowUpDown } from 'lucide-react'
import Link from 'next/link'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteMedicineAction } from './actions'
import { toast } from 'sonner'
import type { Medicine } from '@/lib/types/database'

export const medicineColumns: ColumnDef<Medicine & { medicine_categories?: { name: string } }>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="-ml-4">
        Medicine Name <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.getValue('name')}</div>
        {row.original.generic_name && (
          <div className="text-xs text-muted-foreground">{row.original.generic_name}</div>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'company',
    header: 'Company',
    cell: ({ row }) => <div className="text-sm">{row.getValue('company') ?? '—'}</div>,
  },
  {
    id: 'category',
    header: 'Category',
    cell: ({ row }) => (
      <div className="text-sm">{row.original.medicine_categories?.name ?? '—'}</div>
    ),
  },
  {
    accessorKey: 'unit',
    header: 'Unit',
    cell: ({ row }) => <div className="text-sm">{row.getValue('unit') ?? '—'}</div>,
  },
  {
    accessorKey: 'reorder_level',
    header: () => <div className="text-right">Reorder Lvl</div>,
    cell: ({ row }) => <div className="text-sm text-right">{row.getValue('reorder_level')}</div>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      return (
        <Badge
          variant="outline"
          className={
            status === 'active'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
              : 'border-border bg-muted text-muted-foreground'
          }
        >
          {status === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
  },
  {
    id: 'actions',
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => {
      const medicine = row.original
      return (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href={`/medicines/${medicine.id}/edit`}>
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
          <ConfirmDialog
            title="Delete medicine?"
            description={`Delete "${medicine.name}" from the catalog? This may affect existing stock batches.`}
            onConfirm={async () => {
              const result = await deleteMedicineAction(medicine.id)
              if (result?.error) toast.error(result.error)
              else toast.success('Medicine deleted')
            }}
          />
        </div>
      )
    },
  },
]
