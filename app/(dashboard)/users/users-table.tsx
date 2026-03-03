'use client'

import { useMemo } from 'react'
import { AdvancedDataTable } from '@/components/ui/advanced-data-table'
import { getUserColumns } from './columns'
import type { UserProfile } from '@/lib/types/database'

interface UsersTableProps {
  data: UserProfile[]
  branches: { id: string; name: string }[]
  totalCount: number
  initialPage: number
  initialPageSize: number
  initialSearch: string
  initialSort: string
  initialOrder: 'asc' | 'desc'
}

export function UsersTable({
  data,
  branches,
  totalCount,
  initialPage,
  initialPageSize,
  initialSearch,
  initialSort,
  initialOrder,
}: UsersTableProps) {
  const columns = useMemo(() => getUserColumns(branches), [branches])

  return (
    <AdvancedDataTable
      columns={columns}
      data={data}
      totalCount={totalCount}
      initialPage={initialPage}
      initialPageSize={initialPageSize}
      initialSearch={initialSearch}
      initialSort={initialSort}
      initialOrder={initialOrder}
      searchPlaceholder="Search users…"
      emptyMessage="No users found"
      recordLabel="user"
      columnLabels={{
        name: 'Name',
        role: 'Role',
      }}
    />
  )
}
