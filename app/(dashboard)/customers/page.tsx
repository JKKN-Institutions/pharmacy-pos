import { createClient } from '@/lib/supabase/server'
import { customerColumns } from './columns'
import { PageHeader } from '@/components/ui/page-header'
import { CustomerFormDialog } from '@/components/customers/customer-form-dialog'
import { AdvancedDataTable } from '@/components/ui/advanced-data-table'

const SORTABLE_DB_COLUMNS = ['first_name', 'last_name', 'phone', 'email', 'created_at']

export default async function CustomersPage({
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

  // ── Pagination ─────────────────────────────────────────────────────────────
  const pageSize = Math.min(50, Math.max(10, parseInt(params.pageSize ?? '15')))
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const rangeFrom = (page - 1) * pageSize
  const rangeTo = rangeFrom + pageSize - 1

  // ── Sorting ────────────────────────────────────────────────────────────────
  const sortCol = SORTABLE_DB_COLUMNS.includes(params.sort ?? '') ? params.sort! : 'first_name'
  const ascending = params.order !== 'desc'

  // ── Query ──────────────────────────────────────────────────────────────────
  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .order(sortCol, { ascending })
    .range(rangeFrom, rangeTo)

  if (params.search) query = query.ilike('first_name', `%${params.search}%`)

  const { data: customers, count } = await query

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-card rounded-2xl border shadow-sm p-5 sm:p-6 space-y-5">
        <PageHeader
          title="Customers"
          description={`${count ?? 0} registered customers`}
        >
          <CustomerFormDialog />
        </PageHeader>

        <AdvancedDataTable
          columns={customerColumns}
          data={customers ?? []}
          totalCount={count ?? 0}
          initialPage={page}
          initialPageSize={pageSize}
          initialSearch={params.search ?? ''}
          initialSort={sortCol}
          initialOrder={ascending ? 'asc' : 'desc'}
          searchPlaceholder="Search customer name…"
          emptyMessage="No customers found"
          recordLabel="customer"
          columnLabels={{
            first_name: 'First Name',
            last_name: 'Last Name',
            phone: 'Phone',
            email: 'Email',
          }}
        />
      </div>
    </div>
  )
}
