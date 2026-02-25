import { createClient } from '@/lib/supabase/server'
import { DataTable } from '@/components/ui/data-table'
import { categoryColumns } from './columns'
import { PageHeader } from '@/components/ui/page-header'
import { CategoryFormDialog } from '@/components/medicines/category-form-dialog'

export default async function MedicineCategoriesPage() {
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('medicine_categories')
    .select('*')
    .order('name')

  return (
    <div className="space-y-6">
      <PageHeader title="Medicine Categories" description="Manage medicine classification categories">
        <CategoryFormDialog />
      </PageHeader>
      <DataTable
        columns={categoryColumns}
        data={categories ?? []}
        searchKey="name"
        searchPlaceholder="Search categories..."
      />
    </div>
  )
}
