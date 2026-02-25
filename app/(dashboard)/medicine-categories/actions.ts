'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createCategoryAction(name: string) {
  const supabase = await createClient()
  const { data: branch } = await supabase.from('branches').select('id').limit(1).single()
  const { error } = await supabase.from('medicine_categories').insert({ name, branch_id: branch?.id })
  if (error) return { error: error.message }
  revalidatePath('/medicine-categories')
  return { success: true }
}

export async function updateCategoryAction(id: string, name: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('medicine_categories').update({ name }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/medicine-categories')
  return { success: true }
}

export async function deleteCategoryAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('medicine_categories').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/medicine-categories')
  return { success: true }
}
