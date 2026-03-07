import { createClient } from '@/lib/supabase/server'
import { purchaseColumns } from './columns'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { BulkImportPurchasesButton } from '@/components/purchases/bulk-import-button'
import { AdvancedDataTable } from '@/components/ui/advanced-data-table'
import { bulkDeletePurchasesAction } from './actions'
import { PurchaseTableFilters } from '@/components/purchases/purchase-table-filters'

const SORTABLE_DB_COLUMNS = ['purchase_date', 'total', 'subtotal', 'tax', 'discount', 'created_at']

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    status?: string
    supplier?: string
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

  // ── Pagination ─────────────────────────────────────────────────────────────
  const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize ?? '15')))
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const rangeFrom = (page - 1) * pageSize
  const rangeTo = rangeFrom + pageSize - 1

  // ── Sorting ────────────────────────────────────────────────────────────────
  const sortCol = SORTABLE_DB_COLUMNS.includes(params.sort ?? '') ? params.sort! : 'purchase_date'
  const ascending = params.order === 'asc'

  // ── Query ──────────────────────────────────────────────────────────────────
  // Use !inner join when searching so the supplier name filter actually
  // excludes non-matching parent rows (PostgREST LEFT JOIN only filters
  // embedded rows, not parent rows — !inner makes it an INNER JOIN).
  const selectCols = params.search
    ? '*, suppliers!inner(name)'
    : '*, suppliers(name)'

  let query = supabase
    .from('purchases')
    .select(selectCols, { count: 'exact' })
    .order(sortCol, { ascending })
    .range(rangeFrom, rangeTo)

  if (params.search) query = query.ilike('suppliers.name', `%${params.search}%`)
  if (params.status) query = query.eq('status', params.status)
  if (params.supplier) query = query.eq('supplier_id', params.supplier)
  if (params.from) query = query.gte('purchase_date', params.from)
  if (params.to) query = query.lte('purchase_date', params.to)

  const [{ data: purchases, count }, { data: suppliers }] = await Promise.all([
    query,
    supabase.from('suppliers').select('id, name').order('name'),
  ])

  // Flatten supplier name for column accessor
  const data = (purchases ?? []).map((p: any) => ({
    ...p,
    supplier_name: p.suppliers?.name ?? '',
  }))

  const isFiltered = !!(params.search || params.status || params.supplier || params.from || params.to)

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-card rounded-2xl border shadow-sm p-5 sm:p-6 space-y-5">
        <PageHeader title="Purchases" description={`${count ?? 0} purchases recorded`}>
          <BulkImportPurchasesButton />
          <Button size="sm" asChild className="gap-1.5">
            <Link href="/purchases/new">
              <Plus className="w-4 h-4" />New Purchase
            </Link>
          </Button>
        </PageHeader>

        <AdvancedDataTable
          columns={purchaseColumns}
          data={data}
          totalCount={count ?? 0}
          initialPage={page}
          initialPageSize={pageSize}
          initialSearch={params.search ?? ''}
          initialSort={sortCol}
          initialOrder={ascending ? 'asc' : 'desc'}
          searchPlaceholder="Search supplier name…"
          emptyMessage="No purchases found"
          recordLabel="purchase"
          isFiltered={isFiltered}
          enableRowSelection
          bulkDeleteAction={bulkDeletePurchasesAction}
          columnLabels={{
            supplier_name: 'Supplier',
            subtotal: 'Subtotal',
            tax: 'Tax',
            discount: 'Discount',
            total: 'Amount',
            purchase_date: 'Purchase Date',
          }}
          extraFilters={
            <PurchaseTableFilters
              currentStatus={params.status ?? ''}
              currentSupplier={params.supplier ?? ''}
              suppliers={suppliers ?? []}
            />
          }
        />
      </div>
    </div>
  )
}
