import { createClient } from '@/lib/supabase/server'
import { DataTable } from '@/components/ui/data-table'
import { salaryColumns } from './columns'
import { PageHeader } from '@/components/ui/page-header'
import { SalaryFormDialog } from '@/components/salary/salary-form-dialog'

export default async function SalaryPage() {
  const supabase = await createClient()
  const { data: records } = await supabase
    .from('salary_records')
    .select('*')
    .order('date', { ascending: false })

  return (
    <div className="space-y-6">
      <PageHeader title="Salary Records" description={`${records?.length ?? 0} payment records`}>
        <SalaryFormDialog />
      </PageHeader>
      <DataTable
        columns={salaryColumns}
        data={records ?? []}
        searchKey="staff_name"
        searchPlaceholder="Search staff name..."
      />
    </div>
  )
}