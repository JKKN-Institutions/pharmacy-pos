import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/queries'
import { PageHeader } from '@/components/ui/page-header'
import { format } from 'date-fns'
import { formatINR } from '@/lib/utils/currency'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { ExportButtons } from '@/components/reports/export-buttons'

type StockBatchRow = {
  id: string
  medicine_id: string
  batch_no: string
  expiry_date: string
  available_qty: number
  purchase_price: number
  sale_price: number
  status: string
  medicines: { name: string } | null
}

export default async function InventoryReportPage() {
  const supabase = await createClient()

  const rows = await fetchAllRows<StockBatchRow>(() =>
    supabase
      .from('stock_batches')
      .select(
        'id, medicine_id, batch_no, expiry_date, available_qty, purchase_price, sale_price, status, medicines(name)'
      )
      .eq('status', 'active')
      .order('expiry_date', { ascending: true }),
  )
  const totalStockValue = rows.reduce(
    (s, r) => s + Number(r.available_qty) * Number(r.purchase_price),
    0
  )
  const totalUnits = rows.reduce((s, r) => s + Number(r.available_qty), 0)

  const exportColumns = [
    { header: 'Medicine',        key: 'medicine_name',   width: 32 },
    { header: 'Batch No',        key: 'batch_no',        width: 16 },
    { header: 'Expiry Date',     key: 'expiry_date',     width: 14 },
    { header: 'Qty',             key: 'available_qty',   width: 10, align: 'right' as const },
    { header: 'Purchase (₹)',    key: 'purchase_price',  width: 14, align: 'right' as const },
    { header: 'Selling (₹)',     key: 'sale_price',      width: 14, align: 'right' as const },
    { header: 'Stock Value (₹)', key: 'stock_value',     width: 16, align: 'right' as const },
  ]
  const exportRows = rows.map((r) => ({
    medicine_name:  r.medicines?.name ?? '—',
    batch_no:       r.batch_no,
    expiry_date:    r.expiry_date,
    available_qty:  Number(r.available_qty),
    purchase_price: Number(r.purchase_price).toFixed(2),
    sale_price:     Number(r.sale_price).toFixed(2),
    stock_value:    (Number(r.available_qty) * Number(r.purchase_price)).toFixed(2),
  }))
  const exportSummary = [
    { label: 'Total Stock Value',  value: formatINR(totalStockValue) },
    { label: 'Total Units',        value: totalUnits.toLocaleString('en-IN') },
    { label: 'Active Batches',     value: String(rows.length) },
  ]
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Report"
        description={`${rows.length} active stock batches`}
      >
        <ExportButtons
          title="Inventory Report"
          filename={`inventory-${today}`}
          columns={exportColumns}
          rows={exportRows}
          summaryItems={exportSummary}
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
              Total Stock Value
            </p>
            <p className="text-2xl font-bold">{formatINR(totalStockValue)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Total Units in Stock
            </p>
            <p className="text-2xl font-bold">{totalUnits.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Active Batches
            </p>
            <p className="text-2xl font-bold">{rows.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory table */}
      <Card className="rounded-2xl">
        <CardContent className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="text-left p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    Medicine Name
                  </th>
                  <th className="text-left p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    Batch No.
                  </th>
                  <th className="text-left p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    Expiry Date
                  </th>
                  <th className="text-right p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    Qty
                  </th>
                  <th className="text-right p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    Purchase Price
                  </th>
                  <th className="text-right p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    Selling Price
                  </th>
                  <th className="text-right p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    Stock Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      No active stock batches found
                    </td>
                  </tr>
                ) : (
                  rows.map((batch) => {
                    const stockValue = Number(batch.available_qty) * Number(batch.purchase_price)
                    const expiry = new Date(batch.expiry_date)
                    const now = new Date()
                    const daysToExpiry = Math.ceil(
                      (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                    )
                    const expiryClass =
                      daysToExpiry <= 0
                        ? 'text-red-600 font-medium'
                        : daysToExpiry <= 90
                        ? 'text-amber-600 font-medium'
                        : 'text-muted-foreground'

                    return (
                      <tr key={batch.id} className="hover:bg-muted/20">
                        <td className="p-4 font-medium">
                          {batch.medicines?.name ?? '—'}
                        </td>
                        <td className="p-4 font-mono text-xs text-muted-foreground">
                          {batch.batch_no}
                        </td>
                        <td className={`p-4 text-sm ${expiryClass}`}>
                          {format(expiry, 'dd MMM yyyy')}
                        </td>
                        <td className="p-4 text-right font-semibold">
                          {Number(batch.available_qty).toLocaleString('en-IN')}
                        </td>
                        <td className="p-4 text-right">{formatINR(batch.purchase_price)}</td>
                        <td className="p-4 text-right">{formatINR(batch.sale_price)}</td>
                        <td className="p-4 text-right font-semibold">{formatINR(stockValue)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="bg-muted/40 border-t">
                  <tr>
                    <td colSpan={3} className="p-4 font-semibold text-sm">
                      Total
                    </td>
                    <td className="p-4 text-right font-bold">
                      {totalUnits.toLocaleString('en-IN')}
                    </td>
                    <td colSpan={2} />
                    <td className="p-4 text-right font-bold">{formatINR(totalStockValue)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
