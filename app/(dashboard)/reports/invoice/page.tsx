import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { formatINR } from '@/lib/utils/currency'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { InvoiceTable } from './invoice-table'
import { ExportButtons } from '@/components/reports/export-buttons'
import { ReportDateFilter } from '@/components/reports/report-date-filter'

type InvoiceRow = {
  id: string
  invoice_no: string
  invoice_date: string
  due_date: string | null
  total: number
  paid: number
  due: number
  payment_status: string
  customer_name: string
  customer_phone: string | null
}

export default async function InvoiceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('invoices')
    .select(
      'id, invoice_no, invoice_date, due_date, total, paid, due, payment_status, customer_name, customer_phone',
      { count: 'exact' }
    )
    .order('invoice_date', { ascending: false })

  if (params.from) query = query.gte('invoice_date', params.from)
  if (params.to) query = query.lte('invoice_date', params.to)
  if (params.status) query = query.eq('payment_status', params.status)

  const { data: invoices, count } = await query

  const rows = (invoices ?? []) as InvoiceRow[]

  const totalRevenue = rows.reduce((s, r) => s + Number(r.total), 0)
  const totalCollected = rows.reduce((s, r) => s + Number(r.paid), 0)
  const totalOutstanding = rows.reduce((s, r) => s + Number(r.due), 0)

  const exportColumns = [
    { header: 'Invoice No',  key: 'invoice_no',     width: 16 },
    { header: 'Date',        key: 'invoice_date',   width: 14 },
    { header: 'Due Date',    key: 'due_date',        width: 14 },
    { header: 'Customer',    key: 'customer_name',  width: 22 },
    { header: 'Phone',       key: 'customer_phone', width: 14 },
    { header: 'Total (₹)',   key: 'total',          width: 14, align: 'right' as const },
    { header: 'Paid (₹)',    key: 'paid',           width: 14, align: 'right' as const },
    { header: 'Due (₹)',     key: 'due',            width: 14, align: 'right' as const },
    { header: 'Status',      key: 'payment_status', width: 12 },
  ]
  const exportRows = rows.map((r) => ({
    invoice_no:     r.invoice_no,
    invoice_date:   r.invoice_date,
    due_date:       r.due_date ?? '—',
    customer_name:  r.customer_name,
    customer_phone: r.customer_phone ?? '—',
    total:          Number(r.total).toFixed(2),
    paid:           Number(r.paid).toFixed(2),
    due:            Number(r.due).toFixed(2),
    payment_status: r.payment_status,
  }))
  const exportSummary = [
    { label: 'Total Revenue',     value: formatINR(totalRevenue) },
    { label: 'Total Collected',   value: formatINR(totalCollected) },
    { label: 'Total Outstanding', value: formatINR(totalOutstanding) },
    { label: 'Invoice Count',     value: String(count ?? 0) },
  ]
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice Report"
        description={`${count ?? 0} invoices`}
      >
        <ReportDateFilter />
        <ExportButtons
          title="Invoice Report"
          filename={`invoice-${today}`}
          columns={exportColumns}
          rows={exportRows}
          summaryItems={exportSummary}
          dateRange={{ from: params.from, to: params.to }}
        />
        <Button variant="outline" size="sm" asChild>
          <Link href="/reports">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Reports
          </Link>
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Total Revenue
            </p>
            <p className="text-2xl font-bold">{formatINR(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Total Collected
            </p>
            <p className="text-2xl font-bold text-green-600">{formatINR(totalCollected)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Total Outstanding
            </p>
            <p className="text-2xl font-bold text-red-600">{formatINR(totalOutstanding)}</p>
          </CardContent>
        </Card>
      </div>

      <InvoiceTable invoices={rows} />
    </div>
  )
}
