import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { SettingsForm } from '@/components/settings/settings-form'
import { Settings } from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: settingsRows } = await supabase
    .from('system_settings')
    .select('key, value')

  const settings = Object.fromEntries(
    (settingsRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value])
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure your pharmacy store settings"
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <Settings className="w-4 h-4" />
          <span className="text-sm">System Configuration</span>
        </div>
      </PageHeader>
      <SettingsForm settings={settings} />
    </div>
  )
}
