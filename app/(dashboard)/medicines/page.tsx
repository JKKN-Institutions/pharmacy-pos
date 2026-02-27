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

  return (
    <div className="space-y-6">
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
        data={medicines ?? []}
        totalCount={count ?? 0}
        initialPage={page}
        initialPageSize={pageSize}
        initialSearch={params.search ?? ''}
        initialStatus={params.status ?? ''}
        initialSort={params.sort ?? ''}
        initialOrder={(params.order as 'asc' | 'desc') ?? 'asc'}
      />
    </div>
  )
}
