import { createClient } from '@/lib/supabase/server'
import { DataTable } from '@/components/ui/data-table'
import { invoiceColumns } from './columns'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; payment?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('invoices')
    .select('*, customers(first_name, last_name, phone)', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (params.status) query = query.eq('invoice_status', params.status)
  if (params.payment) query = query.eq('payment_status', params.payment)

  const { data: invoices, count } = await query

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description={`${count ?? 0} credit invoices`}>
        <Button size="sm" asChild>
          <Link href="/invoices/new"><Plus className="w-4 h-4 mr-2" />New Invoice</Link>
        </Button>
      </PageHeader>
      <DataTable
        columns={invoiceColumns}
        data={invoices ?? []}
        searchKey="invoice_no"
        searchPlaceholder="Search invoice number..."
      />
    </div>
  )
}
