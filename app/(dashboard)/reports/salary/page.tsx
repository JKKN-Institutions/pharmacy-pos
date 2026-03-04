import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { formatINR } from '@/lib/utils/currency'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { SalaryTable } from './salary-table'
import { ExportButtons } from '@/components/reports/export-buttons'

type SalaryRow = {
  id: string
  date: string
  staff_name: string
  amount: number
  method: string
  note: string | null
}

export default async function SalaryReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('salary_records')
    .select('id, date, staff_name, amount, method, note', { count: 'exact' })
    .order('date', { ascending: false })

  if (params.from) query = query.gte('date', params.from)
  if (params.to) query = query.lte('date', params.to)

  const { data: records, count } = await query

  const rows = (records ?? []) as SalaryRow[]
  const totalSalary = rows.reduce((s, r) => s + Number(r.amount), 0)

  // Unique staff count
  const uniqueStaff = new Set(rows.map((r) => r.staff_name)).size

  // Per-staff breakdown
  const byStaff = rows.reduce((acc, r) => {
    acc[r.staff_name] = (acc[r.staff_name] ?? 0) + Number(r.amount)
    return acc
  }, {} as Record<string, number>)

  const exportColumns = [
    { header: 'Date',       key: 'date',       width: 14 },
    { header: 'Staff Name', key: 'staff_name', width: 22 },
    { header: 'Amount (₹)', key: 'amount',     width: 14, align: 'right' as const },
    { header: 'Method',     key: 'method',     width: 14 },
    { header: 'Note',       key: 'note',       width: 30 },
  ]
  const exportRows = rows.map((r) => ({
    date:       r.date,
    staff_name: r.staff_name,
    amount:     Number(r.amount).toFixed(2),
    method:     r.method,
    note:       r.note ?? '—',
  }))
  const exportSummary = [
    { label: 'Total Salary Paid', value: formatINR(totalSalary) },
    { label: 'Staff Members',     value: String(uniqueStaff) },
    { label: 'Payment Records',   value: String(count ?? 0) },
  ]
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary Report"
        description={`${count ?? 0} salary payment records`}
      >
        <ExportButtons
          title="Salary Report"
          filename={`salary-${today}`}
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
              Total Salary Paid
            </p>
            <p className="text-2xl font-bold">{formatINR(totalSalary)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Staff Members
            </p>
            <p className="text-2xl font-bold">{uniqueStaff}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Payment Records
            </p>
            <p className="text-2xl font-bold">{count ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-staff breakdown */}
      {Object.keys(byStaff).length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-3">Breakdown by Staff</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(byStaff)
                .sort(([, a], [, b]) => b - a)
                .map(([name, amount]) => (
                  <div key={name} className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground font-medium truncate">{name}</p>
                    <p className="text-sm font-bold mt-0.5">{formatINR(amount)}</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <SalaryTable records={rows} />
    </div>
  )
}
