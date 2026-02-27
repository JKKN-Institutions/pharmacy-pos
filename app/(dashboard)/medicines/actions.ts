'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { medicineSchema } from '@/lib/validators/medicine-schema'
import type { ParsedMedicineRow } from '@/lib/utils/parse-medicines-excel'

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
  // Remove stock batches linked to this medicine before deleting the master record
  await supabase.from('stock_batches').delete().eq('medicine_id', id)
  const { error } = await supabase.from('medicines').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/medicines')
  revalidatePath('/stock')
  return { success: true }
}

// ─── Bulk selection actions ───────────────────────────────────────────────────

export async function bulkDeleteMedicinesAction(ids: string[]): Promise<{
  deleted: number
  error?: string
}> {
  if (!ids.length) return { deleted: 0 }
  const supabase = await createClient()
  // Remove stock batches for all selected medicines first
  await supabase.from('stock_batches').delete().in('medicine_id', ids)
  const { error, count } = await supabase
    .from('medicines')
    .delete({ count: 'exact' })
    .in('id', ids)
  if (error) return { deleted: 0, error: error.message }
  revalidatePath('/medicines')
  revalidatePath('/stock')
  return { deleted: count ?? ids.length }
}

export async function bulkUpdateMedicineStatusAction(
  ids: string[],
  status: 'active' | 'inactive',
): Promise<{ error?: string }> {
  if (!ids.length) return {}
  const supabase = await createClient()
  const { error } = await supabase
    .from('medicines')
    .update({ status, updated_at: new Date().toISOString() })
    .in('id', ids)
  if (error) return { error: error.message }
  revalidatePath('/medicines')
  return {}
}

// ─── Bulk Import ──────────────────────────────────────────────────────────────

export async function bulkImportMedicinesAction(rows: ParsedMedicineRow[]): Promise<{
  inserted: number
  skipped: number
  errors: string[]
}> {
  if (!rows.length) return { inserted: 0, skipped: 0, errors: ['No rows provided'] }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { inserted: 0, skipped: 0, errors: ['Not authenticated'] }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('branch_id')
    .eq('auth_user_id', user.id)
    .single()
  if (!profile?.branch_id) return { inserted: 0, skipped: 0, errors: ['Could not determine branch'] }

  const branch = { id: profile.branch_id }

  // ── Step 1: Build category name → id map, create missing categories ─────────
  const { data: existingCats } = await supabase
    .from('medicine_categories')
    .select('id, name')
    .eq('branch_id', branch.id)

  const catMap = new Map<string, string>() // lowercase name → uuid
  for (const cat of existingCats ?? []) {
    catMap.set(cat.name.toLowerCase().trim(), cat.id)
  }

  // Collect unique category names from import rows that aren't in DB yet
  const uniqueNewCategories = [
    ...new Set(
      rows
        .map((r) => r.category)
        .filter((c): c is string => !!c && !catMap.has(c.toLowerCase().trim())),
    ),
  ]

  for (const catName of uniqueNewCategories) {
    const { data: newCat } = await supabase
      .from('medicine_categories')
      .insert({ branch_id: branch.id, name: catName })
      .select('id')
      .single()
    if (newCat) catMap.set(catName.toLowerCase().trim(), newCat.id)
  }

  // ── Step 2: Fetch existing medicine names to skip duplicates ─────────────────
  const { data: existingMeds } = await supabase
    .from('medicines')
    .select('name')
    .eq('branch_id', branch.id)

  const existingNames = new Set(
    (existingMeds ?? []).map((m) => m.name.toLowerCase().trim()),
  )

  // ── Step 3: Map rows to insert payloads, deduplicating within batch ──────────
  const toInsert: Record<string, unknown>[] = []
  let skipped = 0

  for (const row of rows) {
    const nameLower = row.name.toLowerCase().trim()
    if (existingNames.has(nameLower)) {
      skipped++
      continue
    }
    existingNames.add(nameLower) // prevent within-batch duplicates

    toInsert.push({
      branch_id: branch.id,
      name: row.name,
      company: row.company ?? null,
      unit: row.unit ?? 'Strip',
      unit_packing: row.unit_packing ?? null,
      category_id: row.category
        ? (catMap.get(row.category.toLowerCase().trim()) ?? null)
        : null,
      store_location: row.store_location ?? null,
      reorder_level: row.reorder_level,
      min_level: 0,
      status: row.status,
    })
  }

  if (!toInsert.length) {
    return { inserted: 0, skipped, errors: [] }
  }

  // ── Step 4: Insert in batches of 200 to avoid request timeouts ───────────────
  const BATCH_SIZE = 200
  const errors: string[] = []
  let inserted = 0

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('medicines').insert(batch)
    if (error) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`)
    } else {
      inserted += batch.length
    }
  }

  revalidatePath('/medicines')
  return { inserted, skipped, errors }
}

// ─── Progress-aware import (prepare once, insert in client-driven batches) ────

/**
 * Step 1 of 2 for progress-enabled bulk import.
 * Resolves categories, checks against existing DB names, and returns the
 * ready-to-insert payloads so the client can batch them and track progress.
 */
export async function prepareBulkImportAction(rows: ParsedMedicineRow[]): Promise<{
  payloads: Array<Record<string, unknown>>
  skipped: number
  error?: string
}> {
  if (!rows.length) return { payloads: [], skipped: 0 }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { payloads: [], skipped: 0, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('branch_id')
    .eq('auth_user_id', user.id)
    .single()
  if (!profile?.branch_id) return { payloads: [], skipped: 0, error: 'Could not determine branch' }

  const branchId = profile.branch_id

  // Build category map, creating any missing categories
  const { data: existingCats } = await supabase
    .from('medicine_categories')
    .select('id, name')
    .eq('branch_id', branchId)

  const catMap = new Map<string, string>()
  for (const cat of existingCats ?? []) {
    catMap.set(cat.name.toLowerCase().trim(), cat.id)
  }

  const uniqueNewCats = [
    ...new Set(
      rows
        .map((r) => r.category)
        .filter((c): c is string => !!c && !catMap.has(c.toLowerCase().trim())),
    ),
  ]
  for (const catName of uniqueNewCats) {
    const { data: newCat } = await supabase
      .from('medicine_categories')
      .insert({ branch_id: branchId, name: catName })
      .select('id')
      .single()
    if (newCat) catMap.set(catName.toLowerCase().trim(), newCat.id)
  }

  // Fetch existing names so we can skip duplicates
  const { data: existingMeds } = await supabase
    .from('medicines')
    .select('name')
    .eq('branch_id', branchId)

  const existingNames = new Set(
    (existingMeds ?? []).map((m) => m.name.toLowerCase().trim()),
  )

  // Build insert payloads
  const payloads: Record<string, unknown>[] = []
  let skipped = 0

  for (const row of rows) {
    const nameLower = row.name.toLowerCase().trim()
    if (existingNames.has(nameLower)) { skipped++; continue }
    existingNames.add(nameLower)

    payloads.push({
      branch_id: branchId,
      name: row.name,
      company: row.company ?? null,
      unit: row.unit ?? 'Strip',
      unit_packing: row.unit_packing ?? null,
      category_id: row.category
        ? (catMap.get(row.category.toLowerCase().trim()) ?? null)
        : null,
      store_location: row.store_location ?? null,
      reorder_level: row.reorder_level,
      min_level: 0,
      status: row.status,
    })
  }

  return { payloads, skipped }
}

/**
 * Step 2 of 2 — inserts one pre-built batch. Called repeatedly by the client
 * so it can update a progress bar between each await.
 */
export async function insertMedicineBatchAction(
  payloads: Array<Record<string, unknown>>,
): Promise<{ inserted: number; error?: string }> {
  if (!payloads.length) return { inserted: 0 }
  const supabase = await createClient()
  const { error } = await supabase.from('medicines').insert(payloads)
  if (error) return { inserted: 0, error: error.message }
  return { inserted: payloads.length }
}

/** Called once after all batches complete to flush the Next.js cache. */
export async function finalizeMedicinesImportAction(): Promise<void> {
  revalidatePath('/medicines')
}
