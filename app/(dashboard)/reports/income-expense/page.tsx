import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { formatINR } from '@/lib/utils/currency'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { IncomeExpenseChart, MonthlyData } from './income-expense-chart'
import { ExportButtons } from '@/components/reports/export-buttons'
import { ReportDateFilter } from '@/components/reports/report-date-filter'

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getMonthLabel(key: string): string {
  const [year, month] = key.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

export default async function IncomeExpenseReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let posBillsQuery = supabase
    .from('pos_bills')
    .select('bill_date, total')
  if (params.from) posBillsQuery = posBillsQuery.gte('bill_date', params.from)
  if (params.to) posBillsQuery = posBillsQuery.lte('bill_date', params.to)
  const { data: posBills } = await posBillsQuery

  let invoicesQuery = supabase
    .from('invoices')
    .select('invoice_date, paid')
  if (params.from) invoicesQuery = invoicesQuery.gte('invoice_date', params.from)
  if (params.to) invoicesQuery = invoicesQuery.lte('invoice_date', params.to)
  const { data: invoices } = await invoicesQuery

  let expensesQuery = supabase
    .from('expenses')
    .select('date, amount')
  if (params.from) expensesQuery = expensesQuery.gte('date', params.from)
  if (params.to) expensesQuery = expensesQuery.lte('date', params.to)
  const { data: expenses } = await expensesQuery

  let salaryQuery = supabase
    .from('salary_records')
    .select('date, amount')
  if (params.from) salaryQuery = salaryQuery.gte('date', params.from)
  if (params.to) salaryQuery = salaryQuery.lte('date', params.to)
  const { data: salaryRecords } = await salaryQuery

  // Build monthly aggregates
  const monthlyMap = new Map<string, { income: number; expenses: number }>()

  const ensureMonth = (key: string) => {
    if (!monthlyMap.has(key)) monthlyMap.set(key, { income: 0, expenses: 0 })
  }

  for (const bill of posBills ?? []) {
    const key = getMonthKey(bill.bill_date)
    ensureMonth(key)
    monthlyMap.get(key)!.income += Number(bill.total)
  }
  for (const inv of invoices ?? []) {
    const key = getMonthKey(inv.invoice_date)
    ensureMonth(key)
    monthlyMap.get(key)!.income += Number(inv.paid)
  }
  for (const exp of expenses ?? []) {
    const key = getMonthKey(exp.date)
    ensureMonth(key)
    monthlyMap.get(key)!.expenses += Number(exp.amount)
  }
  for (const sal of salaryRecords ?? []) {
    const key = getMonthKey(sal.date)
    ensureMonth(key)
    monthlyMap.get(key)!.expenses += Number(sal.amount)
  }

  const chartData: MonthlyData[] = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({
      month: getMonthLabel(key),
      income: val.income,
      expenses: val.expenses,
      net: val.income - val.expenses,
    }))

  const totalIncome = chartData.reduce((s, r) => s + r.income, 0)
  const totalExpenses = chartData.reduce((s, r) => s + r.expenses, 0)
  const totalNet = totalIncome - totalExpenses

  const exportColumns = [
    { header: 'Month',        key: 'month',    width: 16 },
    { header: 'Income (₹)',   key: 'income',   width: 16, align: 'right' as const },
    { header: 'Expenses (₹)', key: 'expenses', width: 16, align: 'right' as const },
    { header: 'Net (₹)',      key: 'net',      width: 16, align: 'right' as const },
  ]
  const exportRows = chartData.map((r) => ({
    month:    r.month,
    income:   Number(r.income).toFixed(2),
    expenses: Number(r.expenses).toFixed(2),
    net:      Number(r.net).toFixed(2),
  }))
  const exportSummary = [
    { label: 'Total Income',      value: formatINR(totalIncome) },
    { label: 'Total Expenses',    value: formatINR(totalExpenses) },
    { label: 'Net Profit / Loss', value: formatINR(totalNet) },
  ]
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Income & Expense Report"
        description="Monthly profit and loss summary"
      >
        <ReportDateFilter />
        <ExportButtons
          title="Income & Expense Report"
          filename={`income-expense-${today}`}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Total Income</p>
            <p className="text-2xl font-bold text-green-600">{formatINR(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Total Expenses</p>
            <p className="text-2xl font-bold text-red-600">{formatINR(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Net Profit / Loss</p>
            <p className={`text-2xl font-bold ${totalNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatINR(totalNet)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold mb-4">Monthly Income vs Expenses</h3>
          <IncomeExpenseChart data={chartData} />
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="text-left p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Month</th>
                  <th className="text-right p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Income</th>
                  <th className="text-right p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Expenses</th>
                  <th className="text-right p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {chartData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-muted-foreground">No data available</td>
                  </tr>
                ) : chartData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/20">
                    <td className="p-4 font-medium">{row.month}</td>
                    <td className="p-4 text-right text-green-600 font-medium">{formatINR(row.income)}</td>
                    <td className="p-4 text-right text-red-600">{formatINR(row.expenses)}</td>
                    <td className={`p-4 text-right font-bold ${row.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatINR(row.net)}</td>
                  </tr>
                ))}
              </tbody>
              {chartData.length > 0 && (
                <tfoot className="bg-muted/40 border-t">
                  <tr>
                    <td className="p-4 font-semibold text-sm">Total</td>
                    <td className="p-4 text-right font-bold text-green-600">{formatINR(totalIncome)}</td>
                    <td className="p-4 text-right font-bold text-red-600">{formatINR(totalExpenses)}</td>
                    <td className={`p-4 text-right font-bold ${totalNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatINR(totalNet)}</td>
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