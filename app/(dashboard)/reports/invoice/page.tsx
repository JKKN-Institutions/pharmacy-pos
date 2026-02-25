import { createClient } from '@/lib/supabase/server'
import { DataTable } from '@/components/ui/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '@/components/ui/page-header'
import { format } from 'date-fns'
import { formatINR } from '@/lib/utils/currency'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'

type InvoiceRow = {
  id: string
  invoice_no: string
  invoice_date: string
  due_date: string | null
  total: number
  paid: number
  due: number
  payment_status: string
  customer_name: string
  customer_phone: string | null
}

const paymentStatusColors: Record<string, string> = {
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/30',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
  unpaid: 'bg-red-100 text-red-700 dark:bg-red-900/30',
}

const columns: ColumnDef<InvoiceRow>[] = [
  {
    accessorKey: 'invoice_no',
    header: 'Invoice No.',
    cell: ({ row }) => (
      <div className="font-mono font-medium">{row.getValue('invoice_no')}</div>
    ),
  },
  {
    accessorKey: 'customer_name',
    header: 'Customer',
    cell: ({ row }) => (
      <div>
        <div className="font-medium text-sm">{row.getValue('customer_name') || '—'}</div>
        {row.original.customer_phone && (
          <div className="text-xs text-muted-foreground">{row.original.customer_phone}</div>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'invoice_date',
    header: 'Date',
    cell: ({ row }) => (
      <div className="text-sm">
        {format(new Date(row.getValue('invoice_date')), 'dd MMM yyyy')}
      </div>
    ),
  },
  {
    accessorKey: 'due_date',
    header: 'Due Date',
    cell: ({ row }) => {
      const due = row.getValue('due_date') as string | null
      return (
        <div className="text-sm">
          {due ? format(new Date(due), 'dd MMM yyyy') : '—'}
        </div>
      )
    },
  },
  {
    accessorKey: 'total',
    header: 'Total',
    cell: ({ row }) => (
      <div className="font-semibold">{formatINR(row.getValue('total'))}</div>
    ),
  },
  {
    accessorKey: 'paid',
    header: 'Paid',
    cell: ({ row }) => (
      <div className="text-green-600 font-medium">{formatINR(row.getValue('paid'))}</div>
    ),
  },
  {
    accessorKey: 'due',
    header: 'Outstanding',
    cell: ({ row }) => {
      const due = row.getValue('due') as number
      return (
        <div className={due > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
          {formatINR(due)}
        </div>
      )
    },
  },
  {
    accessorKey: 'payment_status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('payment_status') as string
      return (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${paymentStatusColors[status] ?? 'bg-muted text-muted-foreground'}`}
        >
          {status}
        </span>
      )
    },
  },
]

export default async function InvoiceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('invoices')
    .select(
      'id, invoice_no, invoice_date, due_date, total, paid, due, payment_status, customer_name, customer_phone',
      { count: 'exact' }
    )
    .order('invoice_date', { ascending: false })

  if (params.from) query = query.gte('invoice_date', params.from)
  if (params.to) query = query.lte('invoice_date', params.to)
  if (params.status) query = query.eq('payment_status', params.status)

  const { data: invoices, count } = await query

  const rows = (invoices ?? []) as InvoiceRow[]

  const totalRevenue = rows.reduce((s, r) => s + Number(r.total), 0)
  const totalCollected = rows.reduce((s, r) => s + Number(r.paid), 0)
  const totalOutstanding = rows.reduce((s, r) => s + Number(r.due), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice Report"
        description={`${count ?? 0} invoices`}
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
              Total Revenue
            </p>
            <p className="text-2xl font-bold">{formatINR(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Total Collected
            </p>
            <p className="text-2xl font-bold text-green-600">{formatINR(totalCollected)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Total Outstanding
            </p>
            <p className="text-2xl font-bold text-red-600">{formatINR(totalOutstanding)}</p>
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        searchKey="invoice_no"
        searchPlaceholder="Search invoice number..."
      />
    </div>
  )
}
