import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/queries'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ExportButtons } from '@/components/reports/export-buttons'

export default async function OutOfStockReportPage() {
  const supabase = await createClient()

  const [medicines, stockBatches] = await Promise.all([
    fetchAllRows<{ id: string; name: string; company: string | null; reorder_level: number }>(() =>
      supabase.from('medicines').select('id, name, company, reorder_level').eq('status', 'active').order('name')),
    fetchAllRows<{ medicine_id: string; available_qty: number }>(() =>
      supabase.from('stock_batches').select('medicine_id, available_qty').eq('status', 'active').order('id')),
  ])

  const stockByMedicine = stockBatches.reduce((acc, sb) => {
    acc[sb.medicine_id] = (acc[sb.medicine_id] ?? 0) + Number(sb.available_qty)
    return acc
  }, {} as Record<string, number>)

  const lowStock = medicines.filter(m =>
    (stockByMedicine[m.id] ?? 0) <= m.reorder_level
  ).map(m => ({ ...m, available: stockByMedicine[m.id] ?? 0 }))

  const outOfStockCount = lowStock.filter(m => m.available === 0).length
  const lowStockCount = lowStock.filter(m => m.available > 0).length
  const exportColumns = [
    { header: 'Medicine',      key: 'name',          width: 32 },
    { header: 'Company',       key: 'company',       width: 20 },
    { header: 'Available',     key: 'available',     width: 12, align: 'right' as const },
    { header: 'Reorder Level', key: 'reorder_level', width: 14, align: 'right' as const },
    { header: 'Status',        key: 'status',        width: 14 },
  ]
  const exportRows = lowStock.map((m) => ({
    name:          m.name,
    company:       m.company ?? '—',
    available:     m.available,
    reorder_level: m.reorder_level,
    status:        m.available === 0 ? 'Out of Stock' : 'Low Stock',
  }))
  const exportSummary = [
    { label: 'Out of Stock',    value: String(outOfStockCount) },
    { label: 'Low Stock',       value: String(lowStockCount) },
    { label: 'Total Attention', value: String(lowStock.length) },
  ]
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <PageHeader title="Out of Stock Report" description={`${lowStock.length} medicines at or below reorder level`}>
        <ExportButtons
          title="Out of Stock Report"
          filename={`out-of-stock-${today}`}
          columns={exportColumns}
          rows={exportRows}
          summaryItems={exportSummary}
        />
        <Button variant="outline" size="sm" asChild>
          <Link href="/reports"><ChevronLeft className="w-4 h-4 mr-1" />Reports</Link>
        </Button>
      </PageHeader>
      <Card className="rounded-2xl">
        <CardContent className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-left p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Medicine</th>
                <th className="text-left p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Company</th>
                <th className="text-right p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Available</th>
                <th className="text-right p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Reorder Level</th>
                <th className="text-center p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lowStock.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">All medicines are sufficiently stocked</td></tr>
              ) : lowStock.map(m => (
                <tr key={m.id} className="hover:bg-muted/20">
                  <td className="p-4 font-medium">{m.name}</td>
                  <td className="p-4 text-muted-foreground">{m.company ?? '—'}</td>
                  <td className="p-4 text-right font-semibold text-red-600">{m.available}</td>
                  <td className="p-4 text-right">{m.reorder_level}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m.available === 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30'}`}>
                      {m.available === 0 ? 'Out of Stock' : 'Low Stock'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
