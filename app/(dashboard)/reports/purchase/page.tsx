import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/queries'
import { PageHeader } from '@/components/ui/page-header'
import { formatINR } from '@/lib/utils/currency'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { PurchaseTable } from './purchase-table'
import { ExportButtons } from '@/components/reports/export-buttons'
import { ReportDateFilter } from '@/components/reports/report-date-filter'

type PurchaseRow = {
  id: string
  invoice_no: string
  purchase_date: string
  total: number
  status: string
  suppliers: { name: string } | null
}

export default async function PurchaseReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const rows = await fetchAllRows<PurchaseRow>(() => {
    let q = supabase
      .from('purchases')
      .select('id, invoice_no, purchase_date, total, status, suppliers(name)')
      .order('purchase_date', { ascending: false })
    if (params.from) q = q.gte('purchase_date', params.from)
    if (params.to) q = q.lte('purchase_date', params.to)
    if (params.status) q = q.eq('status', params.status)
    return q
  })
  const count = rows.length
  const totalCost = rows.reduce((s, r) => s + Number(r.total), 0)

  const exportColumns = [
    { header: 'Invoice No',  key: 'invoice_no',    width: 16 },
    { header: 'Date',        key: 'purchase_date', width: 14 },
    { header: 'Supplier',    key: 'supplier_name', width: 24 },
    { header: 'Total (₹)',   key: 'total',         width: 14, align: 'right' as const },
    { header: 'Status',      key: 'status',        width: 14 },
  ]
  const exportRows = rows.map((r) => ({
    invoice_no:    r.invoice_no,
    purchase_date: r.purchase_date,
    supplier_name: r.suppliers?.name ?? '—',
    total:         Number(r.total).toFixed(2),
    status:        r.status,
  }))
  const exportSummary = [
    { label: 'Total Purchase Cost', value: formatINR(totalCost) },
    { label: 'Total Purchases',     value: String(count ?? 0) },
    { label: 'Avg. Purchase Value', value: count ? formatINR(totalCost / count) : formatINR(0) },
  ]
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Report"
        description={`${count ?? 0} purchases`}
      >
        <ReportDateFilter />
        <ExportButtons
          title="Purchase Report"
          filename={`purchase-${today}`}
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
              Total Purchase Cost
            </p>
            <p className="text-2xl font-bold">{formatINR(totalCost)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Total Purchases
            </p>
            <p className="text-2xl font-bold">{count ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Avg. Purchase Value
            </p>
            <p className="text-2xl font-bold">
              {count ? formatINR(totalCost / count) : formatINR(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <PurchaseTable purchases={rows} />
    </div>
  )
}
