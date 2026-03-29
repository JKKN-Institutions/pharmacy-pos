import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { ActivityLogTable } from '@/components/activity-logs/activity-log-table'
import { ExportButton } from '@/components/activity-logs/export-button'
import type { ActivityLog } from '@/lib/types/database'

const SORTABLE_COLUMNS = ['created_at', 'user_name', 'action', 'entity_type']

export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    action?: string
    entity_type?: string
    from?: string
    to?: string
    page?: string
    pageSize?: string
    sort?: string
    order?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // ── Auth guard — admin only ────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  // ── Pagination ─────────────────────────────────────────────────────────────
  const pageSize = Math.min(50, Math.max(10, parseInt(params.pageSize ?? '20')))
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const rangeFrom = (page - 1) * pageSize
  const rangeTo = rangeFrom + pageSize - 1

  // ── Sorting ────────────────────────────────────────────────────────────────
  const sortCol = SORTABLE_COLUMNS.includes(params.sort ?? '')
    ? params.sort!
    : 'created_at'
  const ascending = params.order === 'asc'

  // ── Query ──────────────────────────────────────────────────────────────────
  let query = supabase
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .order(sortCol, { ascending })
    .range(rangeFrom, rangeTo)

  if (params.search) query = query.ilike('user_name', `%${params.search}%`)
  if (params.action) query = query.eq('action', params.action)
  if (params.entity_type) query = query.eq('entity_type', params.entity_type)
  if (params.from) query = query.gte('created_at', params.from)
  if (params.to) query = query.lte('created_at', `${params.to}T23:59:59`)

  const { data: logs, count } = await query

  const isFiltered = !!(
    params.search ||
    params.action ||
    params.entity_type ||
    params.from ||
    params.to
  )

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-card rounded-2xl border shadow-sm p-5 sm:p-6 space-y-5">
        <PageHeader
          title="Activity Log"
          description="Audit trail of all system actions"
        >
          <ExportButton />
        </PageHeader>

        <ActivityLogTable
          data={(logs ?? []) as ActivityLog[]}
          totalCount={count ?? 0}
          initialPage={page}
          initialPageSize={pageSize}
          initialSearch={params.search ?? ''}
          initialSort={sortCol}
          initialOrder={ascending ? 'asc' : 'desc'}
          isFiltered={isFiltered}
          currentAction={params.action ?? ''}
          currentEntityType={params.entity_type ?? ''}
        />
      </div>
    </div>
  )
}
