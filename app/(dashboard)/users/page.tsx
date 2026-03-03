import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { userColumns } from './columns'
import { PageHeader } from '@/components/ui/page-header'
import { UserFormDialog } from '@/components/users/user-form-dialog'
import { AdvancedDataTable } from '@/components/ui/advanced-data-table'

const SORTABLE_DB_COLUMNS = ['name', 'role', 'created_at']

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    page?: string
    pageSize?: string
    sort?: string
    order?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // ── Auth guard ─────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  // ── Pagination ─────────────────────────────────────────────────────────────
  const pageSize = Math.min(50, Math.max(10, parseInt(params.pageSize ?? '15')))
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const rangeFrom = (page - 1) * pageSize
  const rangeTo = rangeFrom + pageSize - 1

  // ── Sorting ────────────────────────────────────────────────────────────────
  const sortCol = SORTABLE_DB_COLUMNS.includes(params.sort ?? '') ? params.sort! : 'created_at'
  const ascending = params.order === 'asc'

  // ── Query ──────────────────────────────────────────────────────────────────
  let query = supabase
    .from('user_profiles')
    .select('*', { count: 'exact' })
    .order(sortCol, { ascending })
    .range(rangeFrom, rangeTo)

  if (params.search) query = query.ilike('name', `%${params.search}%`)

  const { data: users, count } = await query

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-card rounded-2xl border shadow-sm p-5 sm:p-6 space-y-5">
        <PageHeader title="Users" description="Manage staff accounts and roles">
          <UserFormDialog />
        </PageHeader>

        <AdvancedDataTable
          columns={userColumns}
          data={users ?? []}
          totalCount={count ?? 0}
          initialPage={page}
          initialPageSize={pageSize}
          initialSearch={params.search ?? ''}
          initialSort={sortCol}
          initialOrder={ascending ? 'asc' : 'desc'}
          searchPlaceholder="Search users…"
          emptyMessage="No users found"
          recordLabel="user"
          columnLabels={{
            name: 'Name',
            role: 'Role',
          }}
        />
      </div>
    </div>
  )
}
