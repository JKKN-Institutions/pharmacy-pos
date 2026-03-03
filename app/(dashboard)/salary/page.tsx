import { createClient } from '@/lib/supabase/server'
import { salaryColumns } from './columns'
import { PageHeader } from '@/components/ui/page-header'
import { SalaryFormDialog } from '@/components/salary/salary-form-dialog'
import { AdvancedDataTable } from '@/components/ui/advanced-data-table'

const SORTABLE_DB_COLUMNS = ['staff_name', 'amount', 'date', 'created_at']

export default async function SalaryPage({
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
  const sortCol = SORTABLE_DB_COLUMNS.includes(params.sort ?? '') ? params.sort! : 'date'
  const ascending = params.order === 'asc'

  // ── Query ──────────────────────────────────────────────────────────────────
  let query = supabase
    .from('salary_records')
    .select('*', { count: 'exact' })
    .order(sortCol, { ascending })
    .range(rangeFrom, rangeTo)

  if (params.search) query = query.ilike('staff_name', `%${params.search}%`)

  const { data: records, count } = await query

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-card rounded-2xl border shadow-sm p-5 sm:p-6 space-y-5">
        <PageHeader
          title="Salary Records"
          description={`${count ?? 0} payment records`}
        >
          <SalaryFormDialog />
        </PageHeader>

        <AdvancedDataTable
          columns={salaryColumns}
          data={records ?? []}
          totalCount={count ?? 0}
          initialPage={page}
          initialPageSize={pageSize}
          initialSearch={params.search ?? ''}
          initialSort={sortCol}
          initialOrder={ascending ? 'asc' : 'desc'}
          searchPlaceholder="Search staff name…"
          emptyMessage="No salary records found"
          recordLabel="record"
          columnLabels={{
            staff_name: 'Staff Name',
            amount: 'Amount',
            date: 'Date',
          }}
        />
      </div>
    </div>
  )
}
