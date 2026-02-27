'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const salarySchema = z.object({
  staff_name: z.string().min(1, 'Staff name required'),
  amount: z.coerce.number().min(0.01, 'Amount required'),
  method: z.enum(['cash', 'upi', 'card', 'credit']).default('cash'),
  date: z.string().min(1, 'Date required'),
  note: z.string().optional(),
})

export async function createSalaryAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries())
  const parsed = salarySchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: branch } = await supabase.from('branches').select('id').limit(1).single()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('user_profiles').select('id').eq('auth_user_id', user.id).single()
    : { data: null }

  const { error } = await supabase.from('salary_records').insert({
    ...parsed.data,
    note: parsed.data.note || null,
    branch_id: branch?.id,
    created_by: profile?.id,
  })
  if (error) return { error: error.message }
  revalidatePath('/salary')
  revalidatePath('/reports/income-expense')
  revalidatePath('/')
  return { success: true }
}

export async function updateSalaryAction(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries())
  const parsed = salarySchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('salary_records')
    .update({
      ...parsed.data,
      note: parsed.data.note || null,
    })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/salary')
  revalidatePath('/reports/income-expense')
  revalidatePath('/')
  return { success: true }
}

export async function deleteSalaryAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('salary_records').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/salary')
  revalidatePath('/reports/income-expense')
  revalidatePath('/')
  return { success: true }
}