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

type PurchaseRow = {
  id: string
  invoice_no: string
  purchase_date: string
  total: number
  status: string
  suppliers: { name: string } | null
}

const statusColors: Record<string, string> = {
  received: 'bg-green-100 text-green-700 dark:bg-green-900/30',
  returned: 'bg-red-100 text-red-700 dark:bg-red-900/30',
  partial_return: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
}

const columns: ColumnDef<PurchaseRow>[] = [
  {
    accessorKey: 'invoice_no',
    header: 'Invoice No.',
    cell: ({ row }) => (
      <div className="font-mono font-medium">{row.getValue('invoice_no')}</div>
    ),
  },
  {
    id: 'supplier',
    header: 'Supplier',
    cell: ({ row }) => (
      <div className="text-sm font-medium">{row.original.suppliers?.name ?? '—'}</div>
    ),
  },
  {
    accessorKey: 'purchase_date',
    header: 'Date',
    cell: ({ row }) => (
      <div className="text-sm">
        {format(new Date(row.getValue('purchase_date')), 'dd MMM yyyy')}
      </div>
    ),
  },
  {
    accessorKey: 'total',
    header: 'Total Cost',
    cell: ({ row }) => (
      <div className="font-semibold">{formatINR(row.getValue('total'))}</div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      const label =
        status === 'partial_return'
          ? 'Partial Return'
          : status.charAt(0).toUpperCase() + status.slice(1)
      return (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status] ?? 'bg-muted text-muted-foreground'}`}
        >
          {label}
        </span>
      )
    },
  },
]

export default async function PurchaseReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('purchases')
    .select('id, invoice_no, purchase_date, total, status, suppliers(name)', { count: 'exact' })
    .order('purchase_date', { ascending: false })

  if (params.from) query = query.gte('purchase_date', params.from)
  if (params.to) query = query.lte('purchase_date', params.to)
  if (params.status) query = query.eq('status', params.status)

  const { data: purchases, count } = await query

  const rows = (purchases ?? []) as unknown as PurchaseRow[]
  const totalCost = rows.reduce((s, r) => s + Number(r.total), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Report"
        description={`${count ?? 0} purchases`}
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
              Total Purchase Cost
            </p>
            <p className="text-2xl font-bold">{formatINR(totalCost)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Total Purchases
            </p>
            <p className="text-2xl font-bold">{count ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Avg. Purchase Value
            </p>
            <p className="text-2xl font-bold">
              {count ? formatINR(totalCost / count) : formatINR(0)}
            </p>
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
