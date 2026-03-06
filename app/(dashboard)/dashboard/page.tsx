import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/queries'
import { Suspense } from 'react'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { StockAlerts } from '@/components/dashboard/stock-alerts'
import { RecentBills } from '@/components/dashboard/recent-bills'
import { ExpensesChart } from '@/components/dashboard/expenses-chart'
import { ExpenseByTypeChart } from '@/components/dashboard/expense-by-type-chart'
import { SalaryChart } from '@/components/dashboard/salary-chart'
import { PurchaseChart } from '@/components/dashboard/purchase-chart'
import { CustomerChart } from '@/components/dashboard/customer-chart'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns last 12 month slots as 'YYYY-MM', oldest first. */
function getLast12MonthSlots(): string[] {
  const slots: string[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    slots.push(format(d, 'yyyy-MM'))
  }
  return slots
}

/** 'YYYY-MM' → 'Jan', 'Feb', etc. */
function shortMonth(yyyyMM: string): string {
  return format(new Date(yyyyMM + '-01'), 'MMM')
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4 lg:gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[100px] sm:h-[112px] rounded-xl" />
      ))}
    </div>
  )
}

function ChartSkeleton() {
  return <Skeleton className="h-[280px] rounded-xl" />
}

function SmallChartSkeleton() {
  return <Skeleton className="h-[220px] rounded-xl" />
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Overview · ${format(new Date(), 'EEEE, dd MMMM yyyy')}`}
      />

      {/* KPI Cards — Income, Expenses, Salary, Purchase */}
      <Suspense fallback={<KpiSkeleton />}>
        <KpiCardsServer />
      </Suspense>

      {/* Revenue (12-month stacked) + Stock Alerts */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
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

      {/* Expenses Line Chart + Expense by Type Donut */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
        <Suspense fallback={<SmallChartSkeleton />}>
          <ExpensesChartServer />
        </Suspense>
        <Suspense fallback={<SmallChartSkeleton />}>
          <ExpenseByTypeServer />
        </Suspense>
      </div>

      {/* Salary Bar + Purchase Area + Customer Bar */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Suspense fallback={<SmallChartSkeleton />}>
          <SalaryChartServer />
        </Suspense>
        <Suspense fallback={<SmallChartSkeleton />}>
          <PurchaseChartServer />
        </Suspense>
        <Suspense fallback={<SmallChartSkeleton />}>
          <CustomerChartServer />
        </Suspense>
      </div>

      {/* Recent Bills */}
      <Suspense fallback={<ChartSkeleton />}>
        <RecentBillsServer />
      </Suspense>
    </div>
  )
}

// ── Server Data Functions ─────────────────────────────────────────────────────

async function KpiCardsServer() {
  const supabase = await createClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [posBills, invoices, expenses, salary, purchases] = await Promise.all([
    fetchAllRows<{ total: number; bill_date: string }>(() =>
      supabase.from('pos_bills').select('total, bill_date').order('id')),
    fetchAllRows<{ total: number }>(() =>
      supabase.from('invoices').select('total').order('id')),
    fetchAllRows<{ amount: number }>(() =>
      supabase.from('expenses').select('amount').order('id')),
    fetchAllRows<{ amount: number }>(() =>
      supabase.from('salary_records').select('amount').order('id')),
    fetchAllRows<{ total: number }>(() =>
      supabase.from('purchases').select('total').order('id')),
  ])

  const posTotal     = (posBills  ?? []).reduce((s, b) => s + Number(b.total),  0)
  const invoiceTotal = (invoices  ?? []).reduce((s, i) => s + Number(i.total),  0)
  const totalIncome   = posTotal + invoiceTotal
  const totalExpenses = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0)
  const totalSalary   = (salary   ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const totalPurchase = (purchases ?? []).reduce((s, p) => s + Number(p.total), 0)

  const todaySales = (posBills ?? [])
    .filter(b => b.bill_date === today)
    .reduce((s, b) => s + Number(b.total), 0)

  return (
    <KpiCards
      totalIncome={totalIncome}
      totalExpenses={totalExpenses}
      totalSalary={totalSalary}
      totalPurchase={totalPurchase}
      todaySales={todaySales}
    />
  )
}

async function RevenueChartServer() {
  const supabase = await createClient()
  const slots    = getLast12MonthSlots()
  const fromDate = slots[0] + '-01'

  const [bills, invoices] = await Promise.all([
    fetchAllRows<{ bill_date: string; total: number }>(() =>
      supabase.from('pos_bills').select('bill_date, total').gte('bill_date', fromDate).order('id')),
    fetchAllRows<{ invoice_date: string; total: number }>(() =>
      supabase.from('invoices').select('invoice_date, total').gte('invoice_date', fromDate).order('id')),
  ])

  const posMap:     Record<string, number> = Object.fromEntries(slots.map(s => [s, 0]))
  const invoiceMap: Record<string, number> = Object.fromEntries(slots.map(s => [s, 0]))

  ;(bills    ?? []).forEach(b => { const k = b.bill_date?.slice(0, 7);    if (k && k in posMap)     posMap[k]     += Number(b.total) })
  ;(invoices ?? []).forEach(i => { const k = i.invoice_date?.slice(0, 7); if (k && k in invoiceMap) invoiceMap[k] += Number(i.total) })

  const chartData = slots.map(s => ({
    month:   shortMonth(s),
    pos:     posMap[s],
    invoice: invoiceMap[s],
  }))

  return <RevenueChart data={chartData} />
}

async function StockAlertsServer() {
  const supabase = await createClient()
  const today          = format(new Date(), 'yyyy-MM-dd')
  const thirtyDaysOut  = format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')

  const { data: expiring } = await supabase
    .from('stock_batches')
    .select('*, medicines(name)')
    .eq('status', 'active')
    .gte('expiry_date', today)
    .lte('expiry_date', thirtyDaysOut)
    .gt('available_qty', 0)
    .order('expiry_date')
    .limit(5)

  return <StockAlerts items={expiring ?? []} />
}

async function ExpensesChartServer() {
  const supabase = await createClient()
  const slots    = getLast12MonthSlots()
  const fromDate = slots[0] + '-01'

  const expenses = await fetchAllRows<{ date: string; amount: number }>(() =>
    supabase.from('expenses').select('date, amount').gte('date', fromDate).order('id'))

  const map: Record<string, number> = Object.fromEntries(slots.map(s => [s, 0]))
  ;(expenses ?? []).forEach(e => {
    const k = e.date?.slice(0, 7)
    if (k && k in map) map[k] += Number(e.amount)
  })

  return <ExpensesChart data={slots.map(s => ({ month: shortMonth(s), amount: map[s] }))} />
}

async function ExpenseByTypeServer() {
  const supabase = await createClient()

  const expenses = await fetchAllRows<{ expense_type: string; amount: number }>(() =>
    supabase.from('expenses').select('expense_type, amount').order('id'))

  const typeMap: Record<string, number> = {}
  ;(expenses ?? []).forEach(e => {
    const t = (e.expense_type as string) || 'Other'
    typeMap[t] = (typeMap[t] ?? 0) + Number(e.amount)
  })

  const chartData = Object.entries(typeMap)
    .map(([type, amount]) => ({ type, amount }))
    .sort((a, b) => b.amount - a.amount)

  return <ExpenseByTypeChart data={chartData} />
}

async function SalaryChartServer() {
  const supabase = await createClient()
  const slots    = getLast12MonthSlots()
  const fromDate = slots[0] + '-01'

  const salary = await fetchAllRows<{ date: string; amount: number }>(() =>
    supabase.from('salary_records').select('date, amount').gte('date', fromDate).order('id'))

  const map: Record<string, number> = Object.fromEntries(slots.map(s => [s, 0]))
  ;(salary ?? []).forEach(r => {
    const k = r.date?.slice(0, 7)
    if (k && k in map) map[k] += Number(r.amount)
  })

  return <SalaryChart data={slots.map(s => ({ month: shortMonth(s), amount: map[s] }))} />
}

async function PurchaseChartServer() {
  const supabase = await createClient()
  const slots    = getLast12MonthSlots()
  const fromDate = slots[0] + '-01'

  const purchases = await fetchAllRows<{ purchase_date: string; total: number }>(() =>
    supabase.from('purchases').select('purchase_date, total').gte('purchase_date', fromDate).order('id'))

  const map: Record<string, number> = Object.fromEntries(slots.map(s => [s, 0]))
  ;(purchases ?? []).forEach(p => {
    const k = p.purchase_date?.slice(0, 7)
    if (k && k in map) map[k] += Number(p.total)
  })

  return <PurchaseChart data={slots.map(s => ({ month: shortMonth(s), amount: map[s] }))} />
}

async function CustomerChartServer() {
  const supabase = await createClient()
  const slots    = getLast12MonthSlots()
  const fromDate = slots[0] + '-01T00:00:00'

  const customers = await fetchAllRows<{ created_at: string }>(() =>
    supabase.from('customers').select('created_at').gte('created_at', fromDate).order('id'))

  const map: Record<string, number> = Object.fromEntries(slots.map(s => [s, 0]))
  ;(customers ?? []).forEach(c => {
    if (!c.created_at) return
    const k = (c.created_at as string).slice(0, 7)
    if (k in map) map[k]++
  })

  return <CustomerChart data={slots.map(s => ({ month: shortMonth(s), count: map[s] }))} />
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
