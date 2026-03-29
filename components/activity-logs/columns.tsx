'use client'

import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import type { ActivityLog } from '@/lib/types/database'
import { ActivityLogDetailsDialog } from './activity-log-details-dialog'

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCEL: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  LOGIN:  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  LOGOUT: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  EXPORT: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  IMPORT: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

export const activityLogColumns: ColumnDef<ActivityLog>[] = [
  {
    accessorKey: 'created_at',
    header: 'Date / Time',
    cell: ({ row }) => (
      <span className="text-sm tabular-nums text-muted-foreground whitespace-nowrap">
        {format(new Date(row.getValue('created_at')), 'dd/MM/yyyy HH:mm')}
      </span>
    ),
  },
  {
    accessorKey: 'user_name',
    header: 'User',
    cell: ({ row }) => (
      <span className="text-sm font-medium">{row.getValue('user_name')}</span>
    ),
  },
  {
    accessorKey: 'action',
    header: 'Action',
    cell: ({ row }) => {
      const action = row.getValue('action') as string
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${actionColors[action] ?? 'bg-muted text-muted-foreground'}`}
        >
          {action}
        </span>
      )
    },
  },
  {
    accessorKey: 'entity_type',
    header: 'Entity',
    cell: ({ row }) => {
      const entity = row.getValue('entity_type') as string
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs font-medium capitalize">
          {entity.replace(/_/g, ' ')}
        </span>
      )
    },
  },
  {
    accessorKey: 'entity_label',
    header: 'Record',
    cell: ({ row }) => (
      <span className="text-sm max-w-[200px] truncate block">
        {(row.getValue('entity_label') as string | null) ?? '\u2014'}
      </span>
    ),
  },
  {
    id: 'details',
    header: '',
    cell: ({ row }) => {
      const log = row.original
      if (!log.details) return null
      return <ActivityLogDetailsDialog log={log} />
    },
  },
]
