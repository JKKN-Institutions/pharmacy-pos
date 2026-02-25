import { createClient } from '@/lib/supabase/server'
import { DataTable } from '@/components/ui/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '@/components/ui/page-header'
import { format } from 'date-fns'
import { formatINR } from '@/lib/utils/currency'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { PosBill } from '@/lib/types/database'

const columns: ColumnDef<PosBill>[] = [
  { accessorKey: 'bill_no', header: 'Bill No.', cell: ({ row }) => <div className="font-mono font-medium">{row.getValue('bill_no')}</div> },
  { accessorKey: 'bill_date', header: 'Date', cell: ({ row }) => <div className="text-sm">{format(new Date(row.getValue('bill_date')), 'dd MMM yyyy')}</div> },
  { accessorKey: 'customer_name', header: 'Customer', cell: ({ row }) => <div className="text-sm">{row.getValue('customer_name') ?? 'Walk-in'}</div> },
  { accessorKey: 'payment_method', header: 'Method', cell: ({ row }) => <div className="text-sm capitalize">{row.getValue('payment_method')}</div> },
  { accessorKey: 'total', header: 'Total', cell: ({ row }) => <div className="font-semibold">{formatINR(row.getValue('total'))}</div> },
]

export default async function PosBillReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('pos_bills')
    .select('*', { count: 'exact' })
    .order('bill_date', { ascending: false })

  if (params.from) query = query.gte('bill_date', params.from)
  if (params.to) query = query.lte('bill_date', params.to)

  const { data: bills, count } = await query
  const totalRevenue = (bills ?? []).reduce((s, b) => s + Number(b.total), 0)

  return (
    <div className="space-y-6">
      <PageHeader title="POS / Bill Report" description={`${count ?? 0} bills · Total: ${formatINR(totalRevenue)}`}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/reports"><ChevronLeft className="w-4 h-4 mr-1" />Reports</Link>
        </Button>
      </PageHeader>
      <DataTable columns={columns} data={bills ?? []} searchKey="bill_no" searchPlaceholder="Search bill number..." />
    </div>
  )
}
