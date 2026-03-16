import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/queries'
import { stockColumns } from './columns'
import { PageHeader } from '@/components/ui/page-header'
import { StockDataTable } from '@/components/stock/stock-data-table'
import { StockBulkImportButton } from '@/components/stock/stock-bulk-import-button'
import type { StockWithMedicine } from './columns'

const SORTABLE_DB_COLUMNS = [
  'expiry_date',
  'available_qty',
  'sold_qty',
  'initial_qty',
  'purchase_price',
  'sale_price',
]

const VALID_PAGE_SIZES = [10, 15, 25, 50]

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?:     string
    search?:   string
    page?:     string
    pageSize?: string
    sort?:     string
    order?:    string
  }>
}) {
  const params = await searchParams

  const view      = params.view === 'expired' ? 'expired' : params.view === 'all' ? 'all' : 'live'
  const page      = Math.max(1, parseInt(params.page ?? '1', 10))
  const rawPageSize = parseInt(params.pageSize ?? '15', 10)
  const pageSize    = VALID_PAGE_SIZES.includes(rawPageSize) ? rawPageSize : 15
  const search    = params.search?.trim() ?? ''
  const sortCol   = SORTABLE_DB_COLUMNS.includes(params.sort ?? '') ? params.sort! : 'expiry_date'
  const ascending = (params.order ?? 'asc') !== 'desc'

  const supabase  = await createClient()
  const today     = new Date().toISOString().split('T')[0]
  const rangeFrom = (page - 1) * pageSize
  const rangeTo   = rangeFrom + pageSize - 1

  // ── Optional search: resolve medicine names → IDs first ──────────────────────
  let medicineIdFilter: string[] | null = null
  if (search) {
    const matchingMeds = await fetchAllRows<{ id: string }>(() =>
      supabase.from('medicines').select('id').ilike('name', `%${search}%`).order('id'))
    medicineIdFilter = matchingMeds.map((m) => m.id)
  }

  // Short-circuit: search returned no matching medicines → empty result
  let data: StockWithMedicine[] = []
  let totalCount = 0

  if (medicineIdFilter === null || medicineIdFilter.length > 0) {
    let q = supabase
      .from('stock_batches')
      .select('*, medicines(name, company)', { count: 'exact' })

    if (view === 'live') {
      q = q.eq('status', 'active').gte('expiry_date', today).gt('available_qty', 0)
    } else if (view === 'expired') {
      q = q.or(`status.eq.expired,expiry_date.lt.${today}`)
    }
    // view === 'all' → no filters, show everything

    if (medicineIdFilter !== null) {
      q = q.in('medicine_id', medicineIdFilter)
    }

    const { data: rows, count } = await q
      .order(sortCol, { ascending })
      .range(rangeFrom, rangeTo)

    data       = (rows as StockWithMedicine[]) ?? []
    totalCount = count ?? 0
  }

  const title       = view === 'live' ? 'Live Stock' : view === 'expired' ? 'Expired Stock' : 'All Stock'
  const description = `${totalCount.toLocaleString()} batch${totalCount !== 1 ? 'es' : ''}`

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-card rounded-2xl border shadow-sm p-5 sm:p-6 space-y-5">
        <PageHeader title={title} description={description}>
          <StockBulkImportButton />
        </PageHeader>

        <StockDataTable
          columns={stockColumns}
          data={data}
          totalCount={totalCount}
          initialPage={page}
          initialPageSize={pageSize}
          initialSearch={search}
          initialView={view}
          initialSort={sortCol}
          initialOrder={ascending ? 'asc' : 'desc'}
        />
      </div>
    </div>
  )
}
