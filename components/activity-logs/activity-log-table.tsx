'use client'

import { AdvancedDataTable } from '@/components/ui/advanced-data-table'
import { activityLogColumns } from './columns'
import { ActivityLogFilters } from './activity-log-filters'
import type { ActivityLog } from '@/lib/types/database'

interface ActivityLogTableProps {
  data: ActivityLog[]
  totalCount: number
  initialPage: number
  initialPageSize: number
  initialSearch: string
  initialSort: string
  initialOrder: 'asc' | 'desc'
  isFiltered: boolean
  currentAction: string
  currentEntityType: string
}

export function ActivityLogTable({
  data,
  totalCount,
  initialPage,
  initialPageSize,
  initialSearch,
  initialSort,
  initialOrder,
  isFiltered,
  currentAction,
  currentEntityType,
}: ActivityLogTableProps) {
  return (
    <AdvancedDataTable
      columns={activityLogColumns}
      data={data}
      totalCount={totalCount}
      initialPage={initialPage}
      initialPageSize={initialPageSize}
      initialSearch={initialSearch}
      initialSort={initialSort}
      initialOrder={initialOrder}
      searchPlaceholder="Search by user name\u2026"
      emptyMessage="No activity logs found"
      recordLabel="log"
      isFiltered={isFiltered}
      columnLabels={{
        created_at: 'Date / Time',
        user_name: 'User',
        action: 'Action',
        entity_type: 'Entity',
        entity_label: 'Record',
      }}
      extraFilters={
        <ActivityLogFilters
          currentAction={currentAction}
          currentEntityType={currentEntityType}
        />
      }
    />
  )
}
