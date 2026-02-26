'use client'

import * as React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowUpDown } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { TaxEditDialog } from '@/components/settings/tax-form-dialog'
import { deleteTaxRateAction, toggleTaxRateStatusAction } from './actions'
import type { TaxRate } from '@/lib/types/database'

// ─── Row actions — named component to prevent state loss on re-renders ────────

function TaxRateRowActions({ taxRate }: { taxRate: TaxRate }) {
  const [toggling, setToggling] = React.useState(false)

  async function handleToggle() {
    setToggling(true)
    const result = await toggleTaxRateStatusAction(taxRate.id, !taxRate.is_active)
    setToggling(false)
    if (result?.error) toast.error(result.error)
    else toast.success(taxRate.is_active ? 'Tax rate deactivated' : 'Tax rate activated')
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={toggling}
        onClick={handleToggle}
        className="h-8 text-xs text-muted-foreground hover:text-foreground"
      >
        {taxRate.is_active ? 'Deactivate' : 'Activate'}
      </Button>
      <TaxEditDialog taxRate={taxRate} />
      <ConfirmDialog
        title="Delete tax rate?"
        description={`Remove "${taxRate.name} (${taxRate.rate}%)"? This cannot be undone and may affect existing medicine pricing.`}
        onConfirm={async () => {
          const result = await deleteTaxRateAction(taxRate.id)
          if (result?.error) toast.error(result.error)
          else toast.success(`"${taxRate.name}" deleted`)
        }}
      />
    </div>
  )
}

// ─── Column definitions ───────────────────────────────────────────────────────

export const taxRateColumns: ColumnDef<TaxRate>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="-ml-3 h-8 gap-1.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        Tax Name
        <ArrowUpDown className="h-3.5 w-3.5" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-medium text-sm">{row.getValue('name')}</span>
    ),
  },
  {
    accessorKey: 'rate',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="-ml-3 h-8 gap-1.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        Rate (%)
        <ArrowUpDown className="h-3.5 w-3.5" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-sm tabular-nums font-medium">
        {Number(row.getValue('rate')).toFixed(2)}%
      </span>
    ),
  },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }) => {
      const active = row.getValue('is_active') as boolean
      return active ? (
        <Badge
          variant="outline"
          className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs"
        >
          Active
        </Badge>
      ) : (
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground text-xs">
          Inactive
        </Badge>
      )
    },
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {format(new Date(row.getValue('created_at')), 'dd MMM yyyy')}
      </span>
    ),
  },
  {
    id: 'actions',
    enableHiding: false,
    header: () => <div className="text-right pr-2">Actions</div>,
    cell: ({ row }) => <TaxRateRowActions taxRate={row.original} />,
  },
]
