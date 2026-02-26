'use client'

import * as React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { deleteMedicineAction } from './actions'
import { toast } from 'sonner'
import type { Medicine } from '@/lib/types/database'

type MedicineRow = Medicine & { medicine_categories?: { name: string } | null }

// ─── Row actions component ────────────────────────────────────────────────────
// Kept as a named component so React state is stable across table re-renders
function MedicineRowActions({ medicine }: { medicine: MedicineRow }) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    const result = await deleteMedicineAction(medicine.id)
    setIsDeleting(false)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(`"${medicine.name}" deleted`)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 data-[state=open]:bg-muted"
            aria-label={`Actions for ${medicine.name}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem asChild>
            <Link href={`/medicines/${medicine.id}/edit`} className="flex items-center gap-2">
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* Use onSelect (not onClick) so DropdownMenu closes before the dialog opens */}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive focus:bg-destructive/10 flex items-center gap-2"
            onSelect={(e) => {
              e.preventDefault()
              setConfirmOpen(true)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* AlertDialog opened independently so Radix pointer-events are not trapped */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete medicine?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <span className="font-medium text-foreground">&quot;{medicine.name}&quot;</span>{' '}
              from the catalog. This may affect existing stock batches and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Column definitions ───────────────────────────────────────────────────────

export const medicineColumns: ColumnDef<MedicineRow>[] = [
  // ── Selection checkbox ──────────────────────────────────────────────────────
  {
    id: 'select',
    enableSorting: false,
    enableHiding: false,
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
              ? 'indeterminate'
              : false
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all rows on this page"
        className="mt-0.5"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        // Stop click from bubbling so row-level links/buttons still work
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5"
      />
    ),
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="-ml-3 h-8 gap-1.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        Medicine Name
        <ArrowUpDown className="h-3.5 w-3.5" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="min-w-[180px]">
        <p className="font-medium text-sm leading-snug">{row.getValue('name')}</p>
        {row.original.generic_name && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {row.original.generic_name}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'company',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="-ml-3 h-8 gap-1.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        Company
        <ArrowUpDown className="h-3.5 w-3.5" />
      </Button>
    ),
    cell: ({ row }) => {
      const val = row.getValue('company') as string | null
      return val ? (
        <span className="text-sm">{val}</span>
      ) : (
        <span className="text-muted-foreground/50 text-sm">—</span>
      )
    },
  },
  {
    id: 'category',
    header: 'Category',
    cell: ({ row }) => {
      const name = row.original.medicine_categories?.name
      return name ? (
        <Badge variant="outline" className="text-xs font-normal px-2 py-0.5 whitespace-nowrap">
          {name}
        </Badge>
      ) : (
        <span className="text-muted-foreground/50 text-sm">—</span>
      )
    },
  },
  {
    accessorKey: 'unit',
    header: 'Unit',
    cell: ({ row }) => {
      const unit = row.getValue('unit') as string | null
      const packing = row.original.unit_packing
      return (
        <div className="text-sm">
          {unit ?? '—'}
          {packing && (
            <span className="text-muted-foreground text-xs ml-1">({packing})</span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'tax_percent',
    header: () => <div className="text-right">Tax %</div>,
    cell: ({ row }) => {
      const tax = row.getValue('tax_percent') as number | null
      return (
        <div className="text-right text-sm tabular-nums">
          {tax != null ? `${tax}%` : '—'}
        </div>
      )
    },
  },
  {
    accessorKey: 'reorder_level',
    header: ({ column }) => (
      <div className="text-right">
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-mr-3 h-8 gap-1.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          Reorder Lvl
        </Button>
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right text-sm tabular-nums pr-1">
        {row.getValue('reorder_level')}
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as 'active' | 'inactive'
      return status === 'active' ? (
        <Badge
          variant="outline"
          className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs"
        >
          Active
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="border-border bg-muted text-muted-foreground text-xs"
        >
          Inactive
        </Badge>
      )
    },
    filterFn: (row, _id, value) => row.getValue('status') === value,
  },
  {
    id: 'actions',
    enableHiding: false,
    header: () => <div className="text-right pr-2">Actions</div>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <MedicineRowActions medicine={row.original} />
      </div>
    ),
  },
]
