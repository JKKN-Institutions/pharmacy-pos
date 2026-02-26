'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const taxRateSchema = z.object({
  name: z.string().min(1, 'Tax name is required').max(100),
  rate: z.coerce.number().min(0, 'Rate must be 0 or more').max(100, 'Rate cannot exceed 100'),
  is_active: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .optional()
    .default(true),
})

export async function createTaxRateAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries())
  const parsed = taxRateSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()

  // Get branch_id from the authenticated user's profile — more reliable than
  // querying the branches table directly (which may be blocked by its own RLS)
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('branch_id')
    .eq('auth_user_id', user?.id)
    .single()

  if (!profile?.branch_id) return { error: 'Could not determine branch. Please re-login.' }

  const { error } = await supabase.from('tax_rates').insert({
    ...parsed.data,
    branch_id: profile.branch_id,
  })
  if (error) return { error: error.message }

  revalidatePath('/settings/taxes')
  return { success: true }
}

export async function updateTaxRateAction(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries())
  const parsed = taxRateSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('tax_rates')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/settings/taxes')
  return { success: true }
}

export async function deleteTaxRateAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('tax_rates').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/settings/taxes')
  return { success: true }
}

export async function toggleTaxRateStatusAction(id: string, is_active: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tax_rates')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/settings/taxes')
  return { success: true }
}
