import { createClient } from '@/lib/supabase/server'
import { expenseColumns } from './columns'
import { PageHeader } from '@/components/ui/page-header'
import { ExpenseFormDialog } from '@/components/expenses/expense-form-dialog'
import { AdvancedDataTable } from '@/components/ui/advanced-data-table'

const SORTABLE_DB_COLUMNS = ['name', 'amount', 'date', 'category', 'created_at']

export default async function ExpensesPage({
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
    .from('expenses')
    .select('*', { count: 'exact' })
    .order(sortCol, { ascending })
    .range(rangeFrom, rangeTo)

  if (params.search) query = query.ilike('name', `%${params.search}%`)

  const { data: expenses, count } = await query

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-card rounded-2xl border shadow-sm p-5 sm:p-6 space-y-5">
        <PageHeader
          title="Expenses"
          description={`${count ?? 0} expense records`}
        >
          <ExpenseFormDialog />
        </PageHeader>

        <AdvancedDataTable
          columns={expenseColumns}
          data={expenses ?? []}
          totalCount={count ?? 0}
          initialPage={page}
          initialPageSize={pageSize}
          initialSearch={params.search ?? ''}
          initialSort={sortCol}
          initialOrder={ascending ? 'asc' : 'desc'}
          searchPlaceholder="Search expense name…"
          emptyMessage="No expenses found"
          recordLabel="expense"
          columnLabels={{
            name: 'Name',
            amount: 'Amount',
            date: 'Date',
            category: 'Category',
          }}
        />
      </div>
    </div>
  )
}
