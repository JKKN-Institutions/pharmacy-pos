import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { formatINR } from '@/lib/utils/currency'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { ExpensesTable } from './expenses-table'
import { ExportButtons } from '@/components/reports/export-buttons'
import { ReportDateFilter } from '@/components/reports/report-date-filter'

type ExpenseRow = {
  id: string
  date: string
  name: string
  expense_type: string
  amount: number
  method: string
  description: string | null
}

export default async function ExpensesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; type?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('expenses')
    .select('id, date, name, expense_type, amount, method, description', { count: 'exact' })
    .order('date', { ascending: false })

  if (params.from) query = query.gte('date', params.from)
  if (params.to) query = query.lte('date', params.to)
  if (params.type) query = query.eq('expense_type', params.type)

  const { data: expenses, count } = await query

  const rows = (expenses ?? []) as ExpenseRow[]
  const totalExpenses = rows.reduce((s, r) => s + Number(r.amount), 0)

  // Group by type for breakdown
  const byType = rows.reduce((acc, r) => {
    acc[r.expense_type] = (acc[r.expense_type] ?? 0) + Number(r.amount)
    return acc
  }, {} as Record<string, number>)

  const exportColumns = [
    { header: 'Date',        key: 'date',         width: 14 },
    { header: 'Name',        key: 'name',         width: 24 },
    { header: 'Type',        key: 'expense_type', width: 18 },
    { header: 'Method',      key: 'method',       width: 14 },
    { header: 'Amount (₹)',  key: 'amount',       width: 14, align: 'right' as const },
    { header: 'Description', key: 'description',  width: 30 },
  ]
  const exportRows = rows.map((r) => ({
    date:         r.date,
    name:         r.name,
    expense_type: r.expense_type,
    method:       r.method,
    amount:       Number(r.amount).toFixed(2),
    description:  r.description ?? '—',
  }))
  const exportSummary = [
    { label: 'Total Expenses',     value: formatINR(totalExpenses) },
    { label: 'Record Count',       value: String(count ?? 0) },
    { label: 'Expense Categories', value: String(Object.keys(byType).length) },
  ]
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses Report"
        description={`${count ?? 0} expense records`}
      >
        <ReportDateFilter />
        <ExportButtons
          title="Expenses Report"
          filename={`expenses-${today}`}
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
              Total Expenses
            </p>
            <p className="text-2xl font-bold text-red-600">{formatINR(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Total Records
            </p>
            <p className="text-2xl font-bold">{count ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Expense Categories
            </p>
            <p className="text-2xl font-bold">{Object.keys(byType).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Category breakdown */}
      {Object.keys(byType).length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-3">Breakdown by Category</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(byType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, amount]) => (
                  <div key={type} className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground font-medium truncate">{type}</p>
                    <p className="text-sm font-bold mt-0.5">{formatINR(amount)}</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ExpensesTable expenses={rows} />
    </div>
  )
}
