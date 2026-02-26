import { createClient } from '@/lib/supabase/server'
import { MedicineForm } from '@/components/medicines/medicine-form'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'

export default async function EditMedicinePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: medicine }, { data: categories }, { data: taxRates }] = await Promise.all([
    supabase.from('medicines').select('*').eq('id', id).single(),
    supabase.from('medicine_categories').select('id, name').order('name'),
    supabase.from('tax_rates').select('id, name, rate').eq('is_active', true).order('rate'),
  ])

  if (!medicine) notFound()

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Medicine" description={medicine.name}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/medicines"><ChevronLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
      </PageHeader>
      <MedicineForm medicine={medicine} categories={categories ?? []} taxRates={taxRates ?? []} />
    </div>
  )
}
