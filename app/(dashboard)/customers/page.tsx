import { createClient } from '@/lib/supabase/server'
import { DataTable } from '@/components/ui/data-table'
import { customerColumns } from './columns'
import { PageHeader } from '@/components/ui/page-header'
import { CustomerFormDialog } from '@/components/customers/customer-form-dialog'

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .order('first_name')

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description={`${customers?.length ?? 0} registered customers`}>
        <CustomerFormDialog />
      </PageHeader>
      <DataTable
        columns={customerColumns}
        data={customers ?? []}
        searchKey="first_name"
        searchPlaceholder="Search customers..."
      />
    </div>
  )
}
