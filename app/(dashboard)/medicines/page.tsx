import { createClient } from '@/lib/supabase/server'
import { medicineColumns } from './columns'
import { MedicinesDataTable } from '@/components/medicines/medicines-data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Plus, Download } from 'lucide-react'
import Link from 'next/link'
import { BulkImportButton } from '@/components/medicines/bulk-import-button'

// Columns the DB can sort by (must match medicines table column names)
const SORTABLE_DB_COLUMNS = ['name', 'company', 'reorder_level', 'tax_percent', 'created_at']

export default async function MedicinesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    status?: string
    page?: string
    pageSize?: string
    sort?: string
    order?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // ── Pagination ────────────────────────────────────────────────────────────
  const pageSize = Math.min(500, Math.max(10, parseInt(params.pageSize ?? '15')))
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const rangeFrom = (page - 1) * pageSize
  const rangeTo = rangeFrom + pageSize - 1   // Supabase range is inclusive

  // ── Sorting ───────────────────────────────────────────────────────────────
  const sortCol = SORTABLE_DB_COLUMNS.includes(params.sort ?? '') ? params.sort! : 'name'
  const ascending = params.order !== 'desc'

  // ── Query ─────────────────────────────────────────────────────────────────
  let query = supabase
    .from('medicines')
    .select('*, medicine_categories(name)', { count: 'exact' })
    .order(sortCol, { ascending })
    .range(rangeFrom, rangeTo)

  if (params.search) {
    query = query.ilike('name', `%${params.search}%`)
  }
  if (params.status) {
    query = query.eq('status', params.status)
  }

  const { data: medicines, count } = await query

  // ── Live stock: sum available_qty per medicine from active batches ──────────
  const medicineIds = (medicines ?? []).map((m) => m.id)
  const stockMap: Record<string, number> = {}
  if (medicineIds.length > 0) {
    const { data: batchData } = await supabase
      .from('stock_batches')
      .select('medicine_id, available_qty')
      .in('medicine_id', medicineIds)
      .eq('status', 'active')
    for (const row of batchData ?? []) {
      stockMap[row.medicine_id] = (stockMap[row.medicine_id] ?? 0) + (row.available_qty ?? 0)
    }
  }

  const medicinesWithStock = (medicines ?? []).map((m) => ({
    ...m,
    live_stock: stockMap[m.id] ?? 0,
  }))

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-card rounded-2xl border shadow-sm p-5 sm:p-6 space-y-5">
        <PageHeader title="Medicines" description={`${count ?? 0} medicines in catalog`}>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <BulkImportButton />
          <Button size="sm" asChild>
            <Link href="/medicines/new">
              <Plus className="w-4 h-4 mr-2" />
              New Medicine
            </Link>
          </Button>
        </PageHeader>

        <MedicinesDataTable
          columns={medicineColumns}
          data={medicinesWithStock}
          totalCount={count ?? 0}
          initialPage={page}
          initialPageSize={pageSize}
          initialSearch={params.search ?? ''}
          initialStatus={params.status ?? ''}
          initialSort={params.sort ?? ''}
          initialOrder={(params.order as 'asc' | 'desc') ?? 'asc'}
        />
      </div>
    </div>
  )
}
