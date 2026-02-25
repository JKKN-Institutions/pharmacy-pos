'use client'

import { ColumnDef } from '@tanstack/react-table'
import { format, differenceInDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { formatINR } from '@/lib/utils/currency'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { writeOffStockAction } from './actions'
import { toast } from 'sonner'
import type { StockBatch } from '@/lib/types/database'

type StockWithMedicine = StockBatch & { medicines?: { name: string; company: string | null } }

function ExpiryBadge({ date }: { date: string }) {
  const days = differenceInDays(new Date(date), new Date())
  return (
    <span className={cn(
      'text-sm font-medium',
      days < 0 && 'text-red-600 dark:text-red-400',
      days >= 0 && days <= 30 && 'text-amber-600 dark:text-amber-400',
      days > 30 && 'text-foreground'
    )}>
      {format(new Date(date), 'dd MMM yyyy')}
      {days < 0 && ' (Expired)'}
      {days >= 0 && days <= 30 && ` (${days}d left)`}
    </span>
  )
}

export const stockColumns: ColumnDef<StockWithMedicine>[] = [
  {
    id: 'medicine',
    header: 'Medicine',
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.medicines?.name ?? '—'}</div>
        {row.original.medicines?.company && (
          <div className="text-xs text-muted-foreground">{row.original.medicines.company}</div>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'batch_number',
    header: 'Batch No.',
    cell: ({ row }) => <div className="font-mono text-sm">{row.getValue('batch_number')}</div>,
  },
  {
    accessorKey: 'expiry_date',
    header: 'Expiry Date',
    cell: ({ row }) => <ExpiryBadge date={row.getValue('expiry_date')} />,
  },
  {
    accessorKey: 'available_qty',
    header: 'Available',
    cell: ({ row }) => <div className="font-semibold">{row.getValue('available_qty')}</div>,
  },
  {
    accessorKey: 'sold_qty',
    header: 'Sold',
    cell: ({ row }) => <div className="text-sm text-muted-foreground">{row.getValue('sold_qty')}</div>,
  },
  {
    accessorKey: 'sale_price',
    header: 'Sale Price',
    cell: ({ row }) => <div className="text-sm">{formatINR(row.getValue('sale_price'))}</div>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      const colors: Record<string, string> = {
        active: 'bg-green-100 text-green-700 dark:bg-green-900/30',
        expired: 'bg-red-100 text-red-700 dark:bg-red-900/30',
        written_off: 'bg-gray-100 text-gray-600 dark:bg-gray-800',
      }
      return (
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize', colors[status])}>
          {status.replace('_', ' ')}
        </span>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const batch = row.original
      if (batch.status !== 'active') return null
      return (
        <ConfirmDialog
          title='Write off batch?'
          description={'Mark batch ' + batch.batch_number + ' as written off and record an expense entry.'}
          trigger={
            <button className="text-xs text-destructive hover:underline">Write Off</button>
          }
          onConfirm={async () => {
            const result = await writeOffStockAction(batch.id, 'Manual write-off')
            if (result?.error) toast.error(result.error)
            else toast.success('Batch written off')
          }}
        />
      )
    },
  },
]
