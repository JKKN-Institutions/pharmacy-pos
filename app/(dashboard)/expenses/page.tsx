import { createClient } from '@/lib/supabase/server'
import { DataTable } from '@/components/ui/data-table'
import { expenseColumns } from './columns'
import { PageHeader } from '@/components/ui/page-header'
import { ExpenseFormDialog } from '@/components/expenses/expense-form-dialog'

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false })

  return (
    <div className="space-y-6">
      <PageHeader title="Expenses" description={`${expenses?.length ?? 0} expense records`}>
        <ExpenseFormDialog />
      </PageHeader>
      <DataTable
        columns={expenseColumns}
        data={expenses ?? []}
        searchKey="name"
        searchPlaceholder="Search expenses..."
      />
    </div>
  )
}