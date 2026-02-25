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

type ExpenseRow = {
  id: string
  date: string
  name: string
  expense_type: string
  amount: number
  method: string
  description: string | null
}

const methodColors: Record<string, string> = {
  cash: 'bg-green-100 text-green-700 dark:bg-green-900/30',
  upi: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30',
  card: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30',
  credit: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
}

const columns: ColumnDef<ExpenseRow>[] = [
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
    accessorKey: 'name',
    header: 'Expense Name',
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue('name')}</div>
    ),
  },
  {
    accessorKey: 'expense_type',
    header: 'Type',
    cell: ({ row }) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
        {row.getValue('expense_type')}
      </span>
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
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${methodColors[method] ?? 'bg-muted text-muted-foreground'}`}
        >
          {method}
        </span>
      )
    },
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground max-w-xs truncate">
        {row.getValue('description') || '—'}
      </div>
    ),
  },
]

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses Report"
        description={`${count ?? 0} expense records`}
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

      <DataTable
        columns={columns}
        data={rows}
        searchKey="name"
        searchPlaceholder="Search expense name..."
      />
    </div>
  )
}
