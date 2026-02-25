import { createClient } from '@/lib/supabase/server'
import { MedicineForm } from '@/components/medicines/medicine-form'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function NewMedicinePage() {
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('medicine_categories')
    .select('id, name')
    .order('name')

  return (
    <div className="space-y-6">
      <PageHeader title="New Medicine" description="Add a medicine to the catalog">
        <Button variant="outline" size="sm" asChild>
          <Link href="/medicines"><ChevronLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
      </PageHeader>
      <MedicineForm categories={categories ?? []} />
    </div>
  )
}
