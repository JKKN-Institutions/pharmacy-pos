'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const customerSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(1, 'Phone is required'),
  blood_group: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional().or(z.literal('')),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
})

export async function createCustomerAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries())
  const parsed = customerSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: branch } = await supabase.from('branches').select('id').limit(1).single()

  const { error } = await supabase.from('customers').insert({
    ...parsed.data,
    email: parsed.data.email || null,
    gender: (parsed.data.gender as 'male' | 'female' | 'other') || null,
    dob: parsed.data.dob || null,
    branch_id: branch?.id,
  })
  if (error) return { error: error.message }
  revalidatePath('/customers')
  return { success: true }
}

export async function updateCustomerAction(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries())
  const parsed = customerSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase.from('customers').update({
    ...parsed.data,
    email: parsed.data.email || null,
    gender: (parsed.data.gender as 'male' | 'female' | 'other') || null,
    dob: parsed.data.dob || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/customers')
  return { success: true }
}

export async function deleteCustomerAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/customers')
  return { success: true }
}
