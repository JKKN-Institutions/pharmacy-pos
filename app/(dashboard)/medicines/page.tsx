import { createClient } from '@/lib/supabase/server'
import { DataTable } from '@/components/ui/data-table'
import { medicineColumns } from './columns'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Plus, Download } from 'lucide-react'
import Link from 'next/link'

export default async function MedicinesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('medicines')
    .select('*, medicine_categories(name)', { count: 'exact' })
    .order('name')

  if (params.search) {
    query = query.ilike('name', `%${params.search}%`)
  }
  if (params.status) {
    query = query.eq('status', params.status)
  }

  const { data: medicines, count } = await query

  return (
    <div className="space-y-6">
      <PageHeader title="Medicines" description={`${count ?? 0} medicines in catalog`}>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />Export
        </Button>
        <Button size="sm" asChild>
          <Link href="/medicines/new">
            <Plus className="w-4 h-4 mr-2" />New Medicine
          </Link>
        </Button>
      </PageHeader>
      <DataTable
        columns={medicineColumns}
        data={medicines ?? []}
        searchKey="name"
        searchPlaceholder="Search medicines..."
      />
    </div>
  )
}
