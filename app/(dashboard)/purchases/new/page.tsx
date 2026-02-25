import { createClient } from '@/lib/supabase/server'
import { PurchaseForm } from '@/components/purchases/purchase-form'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function NewPurchasePage() {
  const supabase = await createClient()

  const [{ data: suppliers }, { data: medicines }] = await Promise.all([
    supabase.from('suppliers').select('id, name').order('name'),
    supabase.from('medicines').select('id, name, company, unit').eq('status', 'active').order('name'),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="New Purchase" description="Record a new stock purchase from supplier">
        <Button variant="outline" size="sm" asChild>
          <Link href="/purchases"><ChevronLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
      </PageHeader>
      <PurchaseForm suppliers={suppliers ?? []} medicines={medicines ?? []} />
    </div>
  )
}
