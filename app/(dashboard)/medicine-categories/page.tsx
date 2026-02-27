import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { CategoryFormDialog } from '@/components/medicine-categories/category-form-dialog'
import { CategoriesDataTable } from '@/components/medicine-categories/categories-data-table'
import { categoryColumns } from './columns'
import { Tag, CheckCircle2, XCircle, Pill } from 'lucide-react'

export default async function MedicineCategoriesPage() {
  const supabase = await createClient()

  // Fetch categories with medicine count via embedded aggregate
  const { data: raw } = await supabase
    .from('medicine_categories')
    .select('*, medicines(count)')
    .order('name')

  // Normalize medicine count from Supabase aggregate format
  const categories = (raw ?? []).map(c => ({
    ...c,
    medicine_count: (c.medicines as unknown as { count: number }[])?.[0]?.count ?? 0,
  }))

  // Stats
  const total     = categories.length
  const active    = categories.filter(c => c.is_active).length
  const inactive  = total - active
  const withMeds  = categories.filter(c => c.medicine_count > 0).length

  const stats = [
    { label: 'Total',           value: total,    icon: Tag,          iconClass: 'bg-blue-50   dark:bg-blue-950/50   text-blue-600   dark:text-blue-400' },
    { label: 'Active',          value: active,   icon: CheckCircle2, iconClass: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' },
    { label: 'Inactive',        value: inactive, icon: XCircle,      iconClass: 'bg-red-50    dark:bg-red-950/50    text-red-600    dark:text-red-400' },
    { label: 'With Medicines',  value: withMeds, icon: Pill,         iconClass: 'bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medicine Categories"
        description="Classify medicines into categories for better organisation"
      >
        <CategoryFormDialog />
      </PageHeader>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(stat => (
          <Card key={stat.label} className="rounded-xl border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold tracking-tight mt-0.5">{stat.value}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${stat.iconClass.split(' ').slice(0, 2).join(' ')}`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconClass.split(' ').slice(2).join(' ')}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Data table */}
      <CategoriesDataTable columns={categoryColumns} data={categories} />
    </div>
  )
}
