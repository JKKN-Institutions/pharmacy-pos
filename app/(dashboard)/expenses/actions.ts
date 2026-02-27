'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const expenseSchema = z.object({
  name: z.string().min(1, 'Name required'),
  expense_type: z.string().min(1, 'Type required'),
  amount: z.coerce.number().min(0.01, 'Amount required'),
  method: z.enum(['cash', 'upi', 'card', 'credit']).default('cash'),
  date: z.string().min(1, 'Date required'),
  description: z.string().optional(),
})

export async function createExpenseAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries())
  const parsed = expenseSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: branch } = await supabase.from('branches').select('id').limit(1).single()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('user_profiles').select('id').eq('auth_user_id', user.id).single()
    : { data: null }

  const { error } = await supabase.from('expenses').insert({
    ...parsed.data,
    description: parsed.data.description || null,
    branch_id: branch?.id,
    created_by: profile?.id,
  })
  if (error) return { error: error.message }
  revalidatePath('/expenses')
  revalidatePath('/reports/expenses')
  revalidatePath('/reports/income-expense')
  revalidatePath('/')
  return { success: true }
}

export async function updateExpenseAction(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries())
  const parsed = expenseSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase.from('expenses').update({
    ...parsed.data,
    description: parsed.data.description || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/expenses')
  revalidatePath('/reports/expenses')
  revalidatePath('/reports/income-expense')
  revalidatePath('/')
  return { success: true }
}

export async function deleteExpenseAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/expenses')
  revalidatePath('/reports/expenses')
  revalidatePath('/reports/income-expense')
  revalidatePath('/')
  return { success: true }
}