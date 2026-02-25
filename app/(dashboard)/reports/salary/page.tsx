import { createClient } from '@/lib/supabase/server'
import { DataTable } from '@/components/ui/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '@/components/ui/page-header'
import { format } from 'date-fns'
import { formatINR } from '@/lib/utils/currency'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'

type SalaryRow = {
  id: string
  date: string
  staff_name: string
  amount: number
  method: string
  note: string | null
}

const methodColors: Record<string, string> = {
  cash: 'bg-green-100 text-green-700 dark:bg-green-900/30',
  upi: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30',
  card: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30',
  bank_transfer: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30',
  credit: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
}

const columns: ColumnDef<SalaryRow>[] = [
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ row }) => (
      <div className="text-sm">
        {format(new Date(row.getValue('date')), 'dd MMM yyyy')}
      </div>
    ),
  },
  {
    accessorKey: 'staff_name',
    header: 'Staff Name',
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue('staff_name')}</div>
    ),
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => (
      <div className="font-semibold">{formatINR(row.getValue('amount'))}</div>
    ),
  },
  {
    accessorKey: 'method',
    header: 'Method',
    cell: ({ row }) => {
      const method = row.getValue('method') as string
      const label = method.replace('_', ' ')
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${methodColors[method] ?? 'bg-muted text-muted-foreground'}`}
        >
          {label}
        </span>
      )
    },
  },
  {
    accessorKey: 'note',
    header: 'Note',
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground">
        {row.getValue('note') || '—'}
      </div>
    ),
  },
]

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary Report"
        description={`${count ?? 0} salary payment records`}
      >
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

      <DataTable
        columns={columns}
        data={rows}
        searchKey="staff_name"
        searchPlaceholder="Search staff name..."
      />
    </div>
  )
}
