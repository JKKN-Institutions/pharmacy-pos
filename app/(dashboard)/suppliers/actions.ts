'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const supplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
})

export async function createSupplierAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries())
  const parsed = supplierSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: branch } = await supabase.from('branches').select('id').limit(1).single()
  const { error } = await supabase.from('suppliers').insert({
    ...parsed.data,
    email: parsed.data.email || null,
    branch_id: branch?.id,
  })
  if (error) return { error: error.message }
  revalidatePath('/suppliers')
  return { success: true }
}

export async function updateSupplierAction(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries())
  const parsed = supplierSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase.from('suppliers').update({
    ...parsed.data,
    email: parsed.data.email || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/suppliers')
  return { success: true }
}

export async function deleteSupplierAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/suppliers')
  return { success: true }
}
