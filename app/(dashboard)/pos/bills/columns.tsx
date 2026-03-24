'use client'

import { useState } from 'react'
import { ColumnDef, Column } from '@tanstack/react-table'
import { format } from 'date-fns'
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil, Loader2 } from 'lucide-react'
import { formatINR } from '@/lib/utils/currency'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { PosBill } from '@/lib/types/database'
import { BillViewDialog } from './bill-view-dialog'
import { DownloadBillButton } from '@/components/pos/download-bill-button'
import { PrintBillButton } from '@/components/pos/print-bill-button'
import { CancelBillDialog } from './cancel-bill-dialog'
import { getBillItemsForEditAction } from './actions'

// ─── Edit bill button ────────────────────────────────────────────────────────

function EditBillButton({ bill, onEdit }: { bill: PosBill; onEdit: (bill: PosBill, items: any[]) => void }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const result = await getBillItemsForEditAction(bill.id)
    setLoading(false)
    if (result.data) {
      onEdit(bill, result.data)
    } else {
      toast.error('Failed to load bill items for editing')
    }
  }

  if (bill.status === 'cancelled') return null

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      title="Edit bill"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
    </Button>
  )
}

// ─── Reusable sort header ─────────────────────────────────────────────────────

function SortHeader({ label, column }: { label: string; column: Column<PosBill> }) {
  const sorted = column.getIsSorted()
  return (
    <button
      className="flex items-center gap-1 font-semibold text-xs uppercase tracking-wider text-foreground/60 hover:text-foreground transition-colors"
      onClick={() => column.toggleSorting(sorted === 'asc')}
    >
      {label}
      {sorted === 'asc' ? (
        <ArrowUp className="h-3 w-3 text-primary" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="h-3 w-3 text-primary" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  )
}

// ─── Status / Payment badges ──────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; className: string }> = {
  saved:      { label: 'Saved',      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  synced:     { label: 'Synced',     className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  paid:       { label: 'Paid',       className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  pending:    { label: 'Pending',    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  sync_error: { label: 'Error',      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  cancelled:  { label: 'Cancelled',  className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
}

const paymentConfig: Record<string, { label: string; className: string }> = {
  cash:   { label: 'Cash',   className: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
  upi:    { label: 'UPI',    className: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400' },
  card:   { label: 'Card',   className: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' },
  credit: { label: 'Credit', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
}

// ─── Column definitions ───────────────────────────────────────────────────────

export const billColumns: ColumnDef<PosBill>[] = [
  {
    accessorKey: 'bill_no',
    header: ({ column }) => <SortHeader label="Bill #" column={column} />,
    cell: ({ row }) => (
      <span className="font-mono font-semibold text-sm tracking-tight">
        {row.getValue('bill_no')}
      </span>
    ),
    size: 120,
  },
  {
    accessorKey: 'customer_name',
    header: ({ column }) => <SortHeader label="Customer" column={column} />,
    cell: ({ row }) => {
      const name = row.getValue('customer_name') as string | null
      const phone = row.original.customer_phone
      return (
        <div>
          <span className="text-sm font-medium">{name ?? 'Walk-in'}</span>
          {phone && (
            <div className="text-xs text-muted-foreground">{phone}</div>
          )}
        </div>
      )
    },
    size: 180,
  },
  {
    accessorKey: 'payment_method',
    header: ({ column }) => <SortHeader label="Payment" column={column} />,
    cell: ({ row }) => {
      const method = row.getValue('payment_method') as string
      const config = paymentConfig[method] ?? { label: method, className: 'bg-gray-100 text-gray-700' }
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${config.className}`}>
          {config.label}
        </span>
      )
    },
    size: 100,
  },
  {
    accessorKey: 'subtotal',
    header: ({ column }) => <SortHeader label="Subtotal" column={column} />,
    cell: ({ row }) => (
      <span className="text-sm tabular-nums text-muted-foreground">
        {formatINR(row.getValue('subtotal') as number)}
      </span>
    ),
    size: 110,
  },
  {
    accessorKey: 'tax_total',
    header: ({ column }) => <SortHeader label="Tax" column={column} />,
    cell: ({ row }) => {
      const tax = row.getValue('tax_total') as number
      return (
        <span className="text-sm tabular-nums text-muted-foreground">
          {tax > 0 ? formatINR(tax) : '—'}
        </span>
      )
    },
    size: 90,
  },
  {
    accessorKey: 'discount_total',
    header: ({ column }) => <SortHeader label="Discount" column={column} />,
    cell: ({ row }) => {
      const disc = row.getValue('discount_total') as number
      return (
        <span className={`text-sm tabular-nums ${disc > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
          {disc > 0 ? `- ${formatINR(disc)}` : '—'}
        </span>
      )
    },
    size: 100,
  },
  {
    accessorKey: 'total',
    header: ({ column }) => <SortHeader label="Amount" column={column} />,
    cell: ({ row }) => (
      <span className="font-semibold tabular-nums text-sm">
        {formatINR(row.getValue('total') as number)}
      </span>
    ),
    size: 110,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <SortHeader label="Status" column={column} />,
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      const config = statusConfig[status] ?? { label: status, className: 'bg-gray-100 text-gray-700' }
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${config.className}`}>
          {config.label}
        </span>
      )
    },
    size: 90,
  },
  {
    accessorKey: 'bill_date',
    header: ({ column }) => <SortHeader label="Date" column={column} />,
    cell: ({ row }) => {
      const date = row.getValue('bill_date') as string
      return (
        <div>
          <span className="text-sm text-foreground">{format(new Date(date), 'dd MMM yyyy')}</span>
          <div className="text-xs text-muted-foreground">{format(new Date(date), 'EEEE')}</div>
        </div>
      )
    },
    size: 130,
  },
  {
    id: 'actions',
    header: () => <span className="text-xs font-semibold uppercase tracking-wider text-foreground/60">Actions</span>,
    cell: ({ row, table }) => {
      const bill = row.original
      const onEdit = (table.options.meta as any)?.onEditBill as ((bill: PosBill, items: any[]) => void) | undefined
      return (
        <div className="flex items-center gap-0.5">
          <BillViewDialog bill={bill} onEdit={onEdit} />
          {onEdit && <EditBillButton bill={bill} onEdit={onEdit} />}
          <PrintBillButton bill={bill} />
          <DownloadBillButton bill={bill} />
          <CancelBillDialog bill={bill} />
        </div>
      )
    },
    size: 200,
  },
]
