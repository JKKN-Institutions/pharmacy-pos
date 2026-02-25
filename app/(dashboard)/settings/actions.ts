'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type SettingKey = 
  | 'store_name' | 'store_address' | 'store_phone' | 'store_email'
  | 'store_gstin' | 'store_dl' | 'pos_discount_type' | 'pos_payment_method'
  | 'invoice_terms' | 'invoice_footer'

const SETTING_KEYS: SettingKey[] = [
  'store_name', 'store_address', 'store_phone', 'store_email',
  'store_gstin', 'store_dl', 'pos_discount_type', 'pos_payment_method',
  'invoice_terms', 'invoice_footer',
]

export async function saveSettingsAction(formData: FormData) {
  const supabase = await createClient()

  const upserts = SETTING_KEYS.map((key) => ({
    key,
    value: (formData.get(key) as string) ?? '',
  }))

  for (const row of upserts) {
    const { error } = await supabase
      .from('system_settings')
      .upsert(row, { onConflict: 'key' })
    if (error) {
      console.error('Failed to save setting:', row.key, error.message)
      return { error: 'Failed to save: ' + error.message }
    }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function getSettingsAction() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value')
  if (error) return {}
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
}
