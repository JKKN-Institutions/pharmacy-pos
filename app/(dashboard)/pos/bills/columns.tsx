'use client'

import { ColumnDef, Column } from '@tanstack/react-table'
import { format } from 'date-fns'
import { ArrowUpDown } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteBillAction } from './actions'
import { toast } from 'sonner'
import { formatINR } from '@/lib/utils/currency'
import type { PosBill } from '@/lib/types/database'
import { BillViewDialog } from './bill-view-dialog'
import { DownloadBillButton } from '@/components/pos/download-bill-button'

// ─── Reusable sort header ─────────────────────────────────────────────────────

function SortHeader({ label, column }: { label: string; column: Column<PosBill> }) {
  return (
    <button
      className="flex items-center gap-1 font-semibold text-xs uppercase tracking-wider text-foreground/60 hover:text-foreground transition-colors"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  )
}

// ─── Column definitions ───────────────────────────────────────────────────────
// Order matches Screenshot 1137: # | Name | Subtotal | Tax | Discount | Amount | Date | Actions

export const billColumns: ColumnDef<PosBill>[] = [
  {
    accessorKey: 'bill_no',
    header: ({ column }) => <SortHeader label="#" column={column} />,
    cell: ({ row }) => (
      <span className="font-mono font-semibold text-sm tracking-tight">
        {row.getValue('bill_no')}
      </span>
    ),
  },
  {
    accessorKey: 'customer_name',
    header: ({ column }) => <SortHeader label="Name" column={column} />,
    cell: ({ row }) => (
      <span className="text-sm text-primary font-medium hover:underline cursor-pointer">
        {(row.getValue('customer_name') as string | null) ?? 'Walk-in'}
      </span>
    ),
  },
  {
    accessorKey: 'subtotal',
    header: ({ column }) => <SortHeader label="Subtotal" column={column} />,
    cell: ({ row }) => (
      <span className="text-sm tabular-nums">
        {formatINR(row.getValue('subtotal') as number)}
      </span>
    ),
  },
  {
    accessorKey: 'tax_total',
    header: ({ column }) => <SortHeader label="Tax" column={column} />,
    cell: ({ row }) => (
      <span className="text-sm tabular-nums text-muted-foreground">
        {formatINR(row.getValue('tax_total') as number)}
      </span>
    ),
  },
  {
    accessorKey: 'discount_total',
    header: ({ column }) => <SortHeader label="Discount" column={column} />,
    cell: ({ row }) => (
      <span className="text-sm tabular-nums text-muted-foreground">
        {formatINR(row.getValue('discount_total') as number)}
      </span>
    ),
  },
  {
    accessorKey: 'total',
    header: ({ column }) => <SortHeader label="Amount" column={column} />,
    cell: ({ row }) => (
      <span className="font-semibold tabular-nums text-sm">
        {formatINR(row.getValue('total') as number)}
      </span>
    ),
  },
  {
    accessorKey: 'bill_date',
    header: ({ column }) => <SortHeader label="Date" column={column} />,
    cell: ({ row }) => {
      const date = row.getValue('bill_date') as string
      return (
        <span className="text-sm text-muted-foreground">
          {format(new Date(date), 'dd/MM/yyyy')}
        </span>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const bill = row.original
      return (
        <div className="flex items-center gap-1">
          <BillViewDialog bill={bill} />
          <DownloadBillButton bill={bill} />
          <ConfirmDialog
            title="Delete bill?"
            description={`Permanently delete bill ${bill.bill_no}? This cannot be undone.`}
            onConfirm={async () => {
              const result = await deleteBillAction(bill.id)
              if (result?.error) toast.error(result.error)
              else toast.success(`Bill ${bill.bill_no} deleted`)
            }}
          />
        </div>
      )
    },
  },
]
