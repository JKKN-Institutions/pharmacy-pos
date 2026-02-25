import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { StockAlerts } from '@/components/dashboard/stock-alerts'
import { RecentBills } from '@/components/dashboard/recent-bills'
import { PageHeader } from '@/components/ui/page-header'
import { format } from 'date-fns'

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
      ))}
    </div>
  )
}

function ChartSkeleton() {
  return <div className="h-64 rounded-2xl bg-muted animate-pulse" />
}

export default async function DashboardPage() {
  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Overview · ${format(new Date(), 'dd MMMM yyyy')}`}
      />

      <Suspense fallback={<KpiSkeleton />}>
        <KpiCardsServer today={today} />
      </Suspense>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense fallback={<ChartSkeleton />}>
            <RevenueChartServer />
          </Suspense>
        </div>
        <div>
          <Suspense fallback={<ChartSkeleton />}>
            <StockAlertsServer />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<ChartSkeleton />}>
        <RecentBillsServer />
      </Suspense>
    </div>
  )
}

async function KpiCardsServer({ today }: { today: string }) {
  const supabase = await createClient()

  const [
    { data: todayBills },
    { data: totalBills },
    { data: expenses },
    { data: totalMedicines },
  ] = await Promise.all([
    supabase.from('pos_bills').select('total').eq('bill_date', today),
    supabase.from('pos_bills').select('total'),
    supabase.from('expenses').select('amount').gte('date', today.slice(0, 7) + '-01'),
    supabase.from('medicines').select('id').eq('status', 'active'),
  ])

  const todaySales = (todayBills ?? []).reduce((s, b) => s + Number(b.total), 0)
  const totalSales = (totalBills ?? []).reduce((s, b) => s + Number(b.total), 0)
  const monthExpenses = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0)
  const medicineCount = totalMedicines?.length ?? 0

  // Get low stock count
  const { data: stockData } = await supabase
    .from('medicines')
    .select('id, reorder_level')
    .eq('status', 'active')

  let lowStockCount = 0
  if (stockData && stockData.length > 0) {
    const { data: stockBatches } = await supabase
      .from('stock_batches')
      .select('medicine_id, available_qty')
      .eq('status', 'active')

    const stockByMedicine = (stockBatches ?? []).reduce((acc, sb) => {
      acc[sb.medicine_id] = (acc[sb.medicine_id] ?? 0) + Number(sb.available_qty)
      return acc
    }, {} as Record<string, number>)

    lowStockCount = stockData.filter(m => (stockByMedicine[m.id] ?? 0) <= m.reorder_level).length
  }

  return (
    <KpiCards
      todaySales={todaySales}
      totalSales={totalSales}
      monthExpenses={monthExpenses}
      medicineCount={medicineCount}
      lowStockCount={lowStockCount}
    />
  )
}

async function RevenueChartServer() {
  const supabase = await createClient()

  // Get last 7 days of POS bills
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const fromDate = format(sevenDaysAgo, 'yyyy-MM-dd')

  const { data: bills } = await supabase
    .from('pos_bills')
    .select('bill_date, total')
    .gte('bill_date', fromDate)
    .order('bill_date')

  // Aggregate by day
  const dayMap: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dayMap[format(d, 'yyyy-MM-dd')] = 0
  }
  ;(bills ?? []).forEach(b => {
    if (dayMap[b.bill_date] !== undefined) {
      dayMap[b.bill_date] += Number(b.total)
    }
  })

  const chartData = Object.entries(dayMap).map(([date, total]) => ({
    date: format(new Date(date), 'dd MMM'),
    total,
  }))

  return <RevenueChart data={chartData} />
}

async function StockAlertsServer() {
  const supabase = await createClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  // Expiring in next 30 days
  const thirtyDaysLater = new Date()
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)

  const { data: expiring } = await supabase
    .from('stock_batches')
    .select('*, medicines(name)')
    .eq('status', 'active')
    .gte('expiry_date', today)
    .lte('expiry_date', format(thirtyDaysLater, 'yyyy-MM-dd'))
    .gt('available_qty', 0)
    .order('expiry_date')
    .limit(5)

  return <StockAlerts items={expiring ?? []} />
}

async function RecentBillsServer() {
  const supabase = await createClient()
  const { data: bills } = await supabase
    .from('pos_bills')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  return <RecentBills bills={bills ?? []} />
}
