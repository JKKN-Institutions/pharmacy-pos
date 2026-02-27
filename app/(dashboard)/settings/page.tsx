import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { SettingsForm } from '@/components/settings/settings-form'
import { Settings, Database, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const subModules = [
  {
    href: '/settings/data-migration',
    icon: Database,
    label: 'Data Migration',
    description: 'Bulk import medicines, customers, and suppliers',
  },
]

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: settingsRows } = await supabase
    .from('system_settings')
    .select('key, value')

  const settings = Object.fromEntries(
    (settingsRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value])
  )

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Configure your pharmacy store settings"
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <Settings className="w-4 h-4" />
          <span className="text-sm">System Configuration</span>
        </div>
      </PageHeader>

      {/* Sub-module navigation cards */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Sub-modules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subModules.map(({ href, icon: Icon, label, description }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md hover:border-primary/30 group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      <SettingsForm settings={settings} />
    </div>
  )
}
