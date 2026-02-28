import { createClient } from '@/lib/supabase/server'
import { DataTable } from '@/components/ui/data-table'
import { purchaseColumns } from './columns'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { BulkImportPurchasesButton } from '@/components/purchases/bulk-import-button'

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('purchases')
    .select('*, suppliers(name)', { count: 'exact' })
    .order('purchase_date', { ascending: false })

  if (params.from) query = query.gte('purchase_date', params.from)
  if (params.to) query = query.lte('purchase_date', params.to)

  const { data: purchases, count } = await query

  // Flatten supplier name for client-side search
  const data = (purchases ?? []).map((p: any) => ({
    ...p,
    supplier_name: p.suppliers?.name ?? '',
  }))

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase" description={`${count ?? 0} purchases recorded`}>
        <BulkImportPurchasesButton />
        <Button size="sm" asChild>
          <Link href="/purchases/new">
            <Plus className="w-4 h-4 mr-2" />New Purchase
          </Link>
        </Button>
      </PageHeader>
      <DataTable
        columns={purchaseColumns}
        data={data}
        searchKey="supplier_name"
        searchPlaceholder="Search supplier..."
      />
    </div>
  )
}
