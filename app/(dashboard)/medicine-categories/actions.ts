'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ── Create ────────────────────────────────────────────────────────────────────

export async function createCategoryAction(data: {
  name: string
  description?: string
  is_active?: boolean
}) {
  if (!data.name?.trim()) return { error: 'Category name is required' }

  const supabase = await createClient()
  const { data: branch } = await supabase.from('branches').select('id').limit(1).single()

  const { error } = await supabase.from('medicine_categories').insert({
    name: data.name.trim(),
    description: data.description?.trim() || null,
    is_active: data.is_active ?? true,
    branch_id: branch?.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/medicine-categories')
  return { success: true }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateCategoryAction(
  id: string,
  data: { name: string; description?: string; is_active?: boolean }
) {
  if (!data.name?.trim()) return { error: 'Category name is required' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('medicine_categories')
    .update({
      name: data.name.trim(),
      description: data.description?.trim() || null,
      is_active: data.is_active ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/medicine-categories')
  return { success: true }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteCategoryAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('medicine_categories').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/medicine-categories')
  return { success: true }
}

// ── Toggle status ─────────────────────────────────────────────────────────────

export async function toggleCategoryStatusAction(id: string, is_active: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('medicine_categories')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/medicine-categories')
  return { success: true }
}

// ── Bulk delete ───────────────────────────────────────────────────────────────

export async function bulkDeleteCategoriesAction(ids: string[]) {
  if (!ids.length) return { error: 'No categories selected' }
  const supabase = await createClient()
  const { error } = await supabase.from('medicine_categories').delete().in('id', ids)
  if (error) return { error: error.message }
  revalidatePath('/medicine-categories')
  return { deleted: ids.length }
}

// ── Bulk toggle status ────────────────────────────────────────────────────────

export async function bulkToggleCategoryStatusAction(ids: string[], is_active: boolean) {
  if (!ids.length) return { error: 'No categories selected' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('medicine_categories')
    .update({ is_active, updated_at: new Date().toISOString() })
    .in('id', ids)
  if (error) return { error: error.message }
  revalidatePath('/medicine-categories')
  return { success: true }
}
