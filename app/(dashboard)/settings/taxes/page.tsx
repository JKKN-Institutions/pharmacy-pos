import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable } from '@/components/ui/data-table'
import { TaxFormDialog } from '@/components/settings/tax-form-dialog'
import { taxRateColumns } from './columns'

export default async function TaxRatesPage() {
  const supabase = await createClient()

  const { data: taxRates } = await supabase
    .from('tax_rates')
    .select('*')
    .order('rate', { ascending: true })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tax Rates"
        description="Manage GST and other tax rates applied to medicines"
      >
        <TaxFormDialog />
      </PageHeader>

      <DataTable
        columns={taxRateColumns}
        data={taxRates ?? []}
        searchKey="name"
        searchPlaceholder="Search tax rates…"
      />
    </div>
  )
}
