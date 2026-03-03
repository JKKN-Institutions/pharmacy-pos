import { createClient } from '@/lib/supabase/server'
import { supplierColumns } from './columns'
import { SuppliersDataTable } from '@/components/suppliers/suppliers-data-table'
import { PageHeader } from '@/components/ui/page-header'
import { SupplierFormDialog } from '@/components/suppliers/supplier-form-dialog'

// Columns the DB can sort by (must match suppliers table column names)
const SORTABLE_DB_COLUMNS = ['name', 'city', 'created_at']

export default async function SuppliersPage({
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
  const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize ?? '15')))
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const rangeFrom = (page - 1) * pageSize
  const rangeTo = rangeFrom + pageSize - 1   // Supabase range is inclusive

  // ── Sorting ────────────────────────────────────────────────────────────────
  const sortCol = SORTABLE_DB_COLUMNS.includes(params.sort ?? '') ? params.sort! : 'name'
  const ascending = params.order !== 'desc'

  // ── Query ──────────────────────────────────────────────────────────────────
  let query = supabase
    .from('suppliers')
    .select('*', { count: 'exact' })
    .order(sortCol, { ascending })
    .range(rangeFrom, rangeTo)

  if (params.search) {
    query = query.ilike('name', `%${params.search}%`)
  }

  const { data: suppliers, count } = await query

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-card rounded-2xl border shadow-sm p-5 sm:p-6 space-y-5">
        <PageHeader
          title="Suppliers"
          description={`${count ?? 0} supplier${(count ?? 0) !== 1 ? 's' : ''} registered`}
        >
          <SupplierFormDialog />
        </PageHeader>

        <SuppliersDataTable
          columns={supplierColumns}
          data={suppliers ?? []}
          totalCount={count ?? 0}
          initialPage={page}
          initialPageSize={pageSize}
          initialSearch={params.search ?? ''}
          initialSort={params.sort ?? ''}
          initialOrder={(params.order as 'asc' | 'desc') ?? 'asc'}
        />
      </div>
    </div>
  )
}
