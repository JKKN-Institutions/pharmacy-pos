import { createClient } from '@/lib/supabase/server'
import { DataTable } from '@/components/ui/data-table'
import { supplierColumns } from './columns'
import { PageHeader } from '@/components/ui/page-header'
import { SupplierFormDialog } from '@/components/suppliers/supplier-form-dialog'

export default async function SuppliersPage() {
  const supabase = await createClient()
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('*')
    .order('name')

  return (
    <div className="space-y-6">
      <PageHeader title="Suppliers" description="Manage medicine suppliers and vendors">
        <SupplierFormDialog />
      </PageHeader>
      <DataTable
        columns={supplierColumns}
        data={suppliers ?? []}
        searchKey="name"
        searchPlaceholder="Search suppliers..."
      />
    </div>
  )
}
