'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { medicineSchema } from '@/lib/validators/medicine-schema'

export async function createMedicineAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries())
  const parsed = medicineSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: branch } = await supabase.from('branches').select('id').limit(1).single()

  const payload = {
    ...parsed.data,
    category_id: parsed.data.category_id || null,
    branch_id: branch?.id,
  }

  const { error } = await supabase.from('medicines').insert(payload)
  if (error) return { error: error.message }
  revalidatePath('/medicines')
  redirect('/medicines')
}

export async function updateMedicineAction(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries())
  const parsed = medicineSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const payload = {
    ...parsed.data,
    category_id: parsed.data.category_id || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('medicines').update(payload).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/medicines')
  redirect('/medicines')
}

export async function deleteMedicineAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('medicines').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/medicines')
  return { success: true }
}
