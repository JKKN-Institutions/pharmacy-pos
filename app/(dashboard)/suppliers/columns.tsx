'use client'

import { ColumnDef, Column } from '@tanstack/react-table'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Supplier } from '@/lib/types/database'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SupplierEditDialog } from '@/components/suppliers/supplier-form-dialog'
import { deleteSupplierAction } from './actions'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'

// Reusable sortable header — shows ▲/▼ based on current sort state
function SortableHeader({
  column,
  label,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: Column<Supplier, any>
  label: string
}) {
  const sorted = column.getIsSorted()
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 gap-1.5 font-semibold text-xs uppercase tracking-wider hover:bg-transparent"
      onClick={() => column.toggleSorting(sorted === 'asc')}
    >
      {label}
      {sorted === 'asc' ? (
        <ArrowUp className="h-3.5 w-3.5 text-foreground" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="h-3.5 w-3.5 text-foreground" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
      )}
    </Button>
  )
}

// Row actions as a named component — prevents state loss on re-renders
function SupplierRowActions({ supplier }: { supplier: Supplier }) {
  return (
    <div className="flex items-center gap-1">
      <SupplierEditDialog supplier={supplier} />
      <ConfirmDialog
        title="Delete supplier?"
        description={`Delete "${supplier.name}"? This may affect existing purchases linked to this supplier.`}
        onConfirm={async () => {
          const result = await deleteSupplierAction(supplier.id)
          if (result?.error) toast.error(result.error)
          else toast.success('Supplier deleted')
        }}
      />
    </div>
  )
}

export const supplierColumns: ColumnDef<Supplier>[] = [
  // ── Row selection checkbox ─────────────────────────────────────────────────
  {
    id: 'select',
    enableHiding: false,
    enableSorting: false,
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
              ? 'indeterminate'
              : false
        }
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        aria-label="Select row"
      />
    ),
  },

  // ── Name (sortable) ────────────────────────────────────────────────────────
  {
    accessorKey: 'name',
    enableSorting: true,
    header: ({ column }) => <SortableHeader column={column} label="Supplier Name" />,
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue('name')}</div>
    ),
  },

  // ── Contact Person ─────────────────────────────────────────────────────────
  {
    accessorKey: 'contact_person',
    enableSorting: false,
    header: 'Contact Person',
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground">
        {row.getValue('contact_person') ?? '—'}
      </div>
    ),
  },

  // ── Phone ──────────────────────────────────────────────────────────────────
  {
    accessorKey: 'phone',
    enableSorting: false,
    header: 'Phone',
    cell: ({ row }) => (
      <div className="text-sm font-mono tracking-tight">
        {row.getValue('phone') ?? '—'}
      </div>
    ),
  },

  // ── Email ──────────────────────────────────────────────────────────────────
  {
    accessorKey: 'email',
    enableSorting: false,
    header: 'Email',
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground">
        {row.getValue('email') ?? '—'}
      </div>
    ),
  },

  // ── Address (hidden by default, toggleable) ────────────────────────────────
  {
    accessorKey: 'address',
    enableSorting: false,
    header: 'Address',
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground max-w-[200px] truncate">
        {row.getValue('address') ?? '—'}
      </div>
    ),
  },

  // ── City (sortable) ────────────────────────────────────────────────────────
  {
    accessorKey: 'city',
    enableSorting: true,
    header: ({ column }) => <SortableHeader column={column} label="City" />,
    cell: ({ row }) => (
      <div className="text-sm">{row.getValue('city') ?? '—'}</div>
    ),
  },

  // ── Actions ────────────────────────────────────────────────────────────────
  {
    id: 'actions',
    enableHiding: false,
    enableSorting: false,
    cell: ({ row }) => <SupplierRowActions supplier={row.original} />,
  },
]
