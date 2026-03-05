import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { formatINR } from '@/lib/utils/currency'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { PosBillTable } from './pos-bill-table'
import { ExportButtons } from '@/components/reports/export-buttons'
import { ReportDateFilter } from '@/components/reports/report-date-filter'

export default async function PosBillReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('pos_bills')
    .select('*', { count: 'exact' })
    .order('bill_date', { ascending: false })

  if (params.from) query = query.gte('bill_date', params.from)
  if (params.to) query = query.lte('bill_date', params.to)

  const { data: bills, count } = await query
  const billCount = count ?? 0
  const totalRevenue = (bills ?? []).reduce((s, b) => s + Number(b.total), 0)
  const avgBillValue = billCount > 0 ? totalRevenue / billCount : 0

  const exportColumns = [
    { header: 'Bill No',       key: 'bill_no',         width: 16 },
    { header: 'Date',          key: 'bill_date',        width: 14 },
    { header: 'Customer',      key: 'customer_name',    width: 22 },
    { header: 'Doctor',        key: 'doctor',           width: 20 },
    { header: 'Payment',       key: 'payment_method',   width: 14 },
    { header: 'Subtotal',      key: 'subtotal',         width: 14, align: 'right' as const },
    { header: 'Discount',      key: 'discount_total',   width: 12, align: 'right' as const },
    { header: 'Tax',           key: 'tax_total',        width: 10, align: 'right' as const },
    { header: 'Total (₹)',     key: 'total',            width: 14, align: 'right' as const },
  ]
  const exportRows = (bills ?? []).map((b) => ({
    bill_no:          b.bill_no,
    bill_date:        b.bill_date,
    customer_name:    b.customer_name ?? '—',
    doctor:           b.doctor ?? '—',
    payment_method:   b.payment_method,
    subtotal:         Number(b.subtotal).toFixed(2),
    discount_total:   Number(b.discount_total).toFixed(2),
    tax_total:        Number(b.tax_total).toFixed(2),
    total:            Number(b.total).toFixed(2),
  }))
  const exportSummary = [
    { label: 'Total Revenue',    value: formatINR(totalRevenue) },
    { label: 'Bill Count',       value: String(billCount) },
    { label: 'Avg. Bill Value',  value: formatINR(avgBillValue) },
  ]
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <PageHeader title="POS / Bill Report" description={`${billCount} bills`}>
        <ReportDateFilter />
        <ExportButtons
          title="POS / Bill Report"
          filename={`pos-bill-${today}`}
          columns={exportColumns}
          rows={exportRows}
          summaryItems={exportSummary}
          dateRange={params}
        />
        <Button variant="outline" size="sm" asChild>
          <Link href="/reports"><ChevronLeft className="w-4 h-4 mr-1" />Reports</Link>
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Total Revenue
            </p>
            <p className="text-2xl font-bold text-green-600">{formatINR(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Total Bills
            </p>
            <p className="text-2xl font-bold">{billCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Avg. Bill Value
            </p>
            <p className="text-2xl font-bold">{formatINR(avgBillValue)}</p>
          </CardContent>
        </Card>
      </div>

      <PosBillTable bills={bills ?? []} />
    </div>
  )
}
