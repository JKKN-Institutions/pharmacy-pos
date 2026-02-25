import { createClient } from '@/lib/supabase/server'
import { DataTable } from '@/components/ui/data-table'
import { stockColumns } from './columns'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import Link from 'next/link'

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const params = await searchParams
  const view = params.view ?? 'live'
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  let query = supabase
    .from('stock_batches')
    .select('*, medicines(name, company)', { count: 'exact' })
    .order('expiry_date', { ascending: true })

  if (view === 'live') {
    query = query.eq('status', 'active').gte('expiry_date', today)
  } else {
    query = query.or(`status.eq.expired,expiry_date.lt.${today}`)
  }

  const { data: stock, count } = await query

  return (
    <div className="space-y-6">
      <PageHeader title={view === 'live' ? 'Live Stock' : 'Expired Stock'} description={`${count ?? 0} stock batches`}>
        <div className="flex gap-2">
          <Button
            variant={view === 'live' ? 'default' : 'outline'}
            size="sm"
            asChild
          >
            <Link href="/stock?view=live">Live Stock</Link>
          </Button>
          <Button
            variant={view === 'expired' ? 'default' : 'outline'}
            size="sm"
            asChild
          >
            <Link href="/stock?view=expired">Expired</Link>
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />Export
          </Button>
        </div>
      </PageHeader>
      <DataTable
        columns={stockColumns}
        data={stock ?? []}
        searchKey="batch_number"
        searchPlaceholder="Search by batch no..."
      />
    </div>
  )
}
