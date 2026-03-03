import { createClient } from '@/lib/supabase/server'
import { invoiceColumns } from './columns'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { AdvancedDataTable } from '@/components/ui/advanced-data-table'
import { InvoiceTableFilters } from '@/components/invoices/invoice-table-filters'

const SORTABLE_DB_COLUMNS = ['invoice_no', 'invoice_date', 'due_date', 'total', 'due', 'payment_status', 'created_at']

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    status?: string
    payment?: string
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
  const sortCol = SORTABLE_DB_COLUMNS.includes(params.sort ?? '') ? params.sort! : 'created_at'
  const ascending = params.order === 'asc'

  // ── Query ──────────────────────────────────────────────────────────────────
  let query = supabase
    .from('invoices')
    .select('*, customers(first_name, last_name, phone)', { count: 'exact' })
    .order(sortCol, { ascending })
    .range(rangeFrom, rangeTo)

  if (params.search) query = query.ilike('invoice_no', `%${params.search}%`)
  if (params.status) query = query.eq('invoice_status', params.status)
  if (params.payment) query = query.eq('payment_status', params.payment)

  const { data: invoices, count } = await query

  const isFiltered = !!(params.search || params.status || params.payment)

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-card rounded-2xl border shadow-sm p-5 sm:p-6 space-y-5">
        <PageHeader title="Invoices" description={`${count ?? 0} credit invoices`}>
          <Button size="sm" asChild>
            <Link href="/invoices/new">
              <Plus className="w-4 h-4 mr-2" />New Invoice
            </Link>
          </Button>
        </PageHeader>

        <AdvancedDataTable
          columns={invoiceColumns}
          data={invoices ?? []}
          totalCount={count ?? 0}
          initialPage={page}
          initialPageSize={pageSize}
          initialSearch={params.search ?? ''}
          initialSort={sortCol}
          initialOrder={ascending ? 'asc' : 'desc'}
          searchPlaceholder="Search invoice number…"
          emptyMessage="No invoices found"
          recordLabel="invoice"
          isFiltered={isFiltered}
          columnLabels={{
            invoice_no: 'Invoice No.',
            customer: 'Customer',
            invoice_date: 'Date',
            due_date: 'Due Date',
            total: 'Total',
            due: 'Due Amount',
            payment_status: 'Payment Status',
          }}
          extraFilters={
            <InvoiceTableFilters
              currentStatus={params.status ?? ''}
              currentPayment={params.payment ?? ''}
            />
          }
        />
      </div>
    </div>
  )
}
