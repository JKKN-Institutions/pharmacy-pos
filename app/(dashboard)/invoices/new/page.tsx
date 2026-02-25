import { createClient } from '@/lib/supabase/server'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function NewInvoicePage() {
  const supabase = await createClient()
  const { data: customers } = await supabase
    .from('customers')
    .select('id, first_name, last_name, phone')
    .order('first_name')

  return (
    <div className="space-y-6">
      <PageHeader title="New Invoice" description="Create a credit invoice for a customer">
        <Button variant="outline" size="sm" asChild>
          <Link href="/invoices"><ChevronLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
      </PageHeader>
      <InvoiceForm customers={customers ?? []} />
    </div>
  )
}
