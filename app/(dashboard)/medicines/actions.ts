'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { medicineSchema, VALID_UNITS } from '@/lib/validators/medicine-schema'
import type { ParsedMedicineRow } from '@/lib/utils/parse-medicines-excel'
import {
  buildFingerprint,
  levenshteinDistance,
  FUZZY_THRESHOLD,
  type ExactConflict,
  type FuzzyMatch,
  type ConflictResolutionsMap,
} from '@/lib/utils/duplicate-detection'

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
      unit: row.unit && (VALID_UNITS as readonly string[]).includes(row.unit) ? row.unit : null,
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

// ─── Duplicate detection (Step 1 of the new wizard) ─────────────────────────

/**
 * Checks import rows against the existing medicine catalogue.
 * Returns exact conflicts (same composite fingerprint) and fuzzy matches
 * (similar name within FUZZY_THRESHOLD edits but different fingerprint).
 */
export async function checkBulkDuplicatesAction(
  rows: ParsedMedicineRow[],
): Promise<{ exactConflicts: ExactConflict[]; fuzzyMatches: FuzzyMatch[]; error?: string }> {
  if (!rows.length) return { exactConflicts: [], fuzzyMatches: [] }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { exactConflicts: [], fuzzyMatches: [], error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('branch_id')
    .eq('auth_user_id', user.id)
    .single()
  if (!profile?.branch_id)
    return { exactConflicts: [], fuzzyMatches: [], error: 'Could not determine branch' }

  const branchId = profile.branch_id

  const { data: existingMeds } = await supabase
    .from('medicines')
    .select('id, name, company, generic_name, unit')
    .eq('branch_id', branchId)

  const meds = existingMeds ?? []

  // Build fingerprint → existing record map for O(1) exact lookups
  const fpMap = new Map<string, {
    id: string
    name: string
    company: string | null
    generic_name: string | null
    unit: string | null
  }>()
  for (const m of meds) {
    const fp = buildFingerprint(m.name, m.company, m.generic_name, m.unit)
    fpMap.set(fp, m)
  }

  const exactConflicts: ExactConflict[] = []
  const fuzzyMatches: FuzzyMatch[] = []

  for (const row of rows) {
    const fp = buildFingerprint(row.name, row.company, row.generic_name, row.unit)
    const existing = fpMap.get(fp)

    if (existing) {
      exactConflicts.push({
        raw_row: row.raw_row,
        importedRow: row,
        existingId: existing.id,
        existingName: existing.name,
        existingCompany: existing.company,
        existingGenericName: existing.generic_name,
        existingUnit: existing.unit,
      })
      continue
    }

    // Fuzzy check: compare imported name against all existing names
    // Early-exit inside levenshteinDistance handles |len difference| > FUZZY_THRESHOLD
    const importedNameLower = row.name.toLowerCase()
    for (const m of meds) {
      const dist = levenshteinDistance(importedNameLower, m.name.toLowerCase())
      if (dist >= 1 && dist <= FUZZY_THRESHOLD) {
        fuzzyMatches.push({
          raw_row: row.raw_row,
          importedName: row.name,
          existingId: m.id,
          existingName: m.name,
          distance: dist,
        })
        break // report only the closest match per import row
      }
    }
  }

  return { exactConflicts, fuzzyMatches }
}

// ─── Progress-aware import (prepare once, insert in client-driven batches) ────

/**
 * Step 2 of the new wizard: resolves categories, checks against the DB using
 * composite fingerprints, and splits rows into insertPayloads (new) and
 * upsertPayloads (overwrite-selected conflicts).
 *
 * conflictResolutions maps raw_row → { action, existingId }. Rows not in the
 * map that also exist in the DB are skipped.
 */
export async function prepareBulkImportAction(
  rows: ParsedMedicineRow[],
  conflictResolutions: ConflictResolutionsMap = {},
): Promise<{
  insertPayloads: Array<Record<string, unknown>>
  upsertPayloads: Array<Record<string, unknown>>
  skipped: number
  error?: string
}> {
  if (!rows.length) return { insertPayloads: [], upsertPayloads: [], skipped: 0 }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { insertPayloads: [], upsertPayloads: [], skipped: 0, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('branch_id')
    .eq('auth_user_id', user.id)
    .single()
  if (!profile?.branch_id)
    return { insertPayloads: [], upsertPayloads: [], skipped: 0, error: 'Could not determine branch' }

  const branchId = profile.branch_id

  // ── Build category map, creating any missing categories ──────────────────────
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

  // ── Fetch existing medicines for composite fingerprint dedup ─────────────────
  const { data: existingMeds } = await supabase
    .from('medicines')
    .select('id, name, company, generic_name, unit')
    .eq('branch_id', branchId)

  const fpMap = new Map<string, string>() // fingerprint → existing id
  for (const m of existingMeds ?? []) {
    const fp = buildFingerprint(m.name, m.company, m.generic_name, m.unit)
    fpMap.set(fp, m.id)
  }

  // ── Build insert / upsert payloads ───────────────────────────────────────────
  const insertPayloads: Record<string, unknown>[] = []
  const upsertPayloads: Record<string, unknown>[] = []
  let skipped = 0
  const seenFPs = new Set<string>() // prevent within-batch duplicates

  for (const row of rows) {
    const fp = buildFingerprint(row.name, row.company, row.generic_name, row.unit)
    const existingId = fpMap.get(fp)
    const resolution = conflictResolutions[row.raw_row]

    const payload: Record<string, unknown> = {
      branch_id: branchId,
      name: row.name,
      company: row.company ?? null,
      generic_name: row.generic_name ?? null,
      unit: row.unit && (VALID_UNITS as readonly string[]).includes(row.unit) ? row.unit : null,
      unit_packing: row.unit_packing ?? null,
      category_id: row.category
        ? (catMap.get(row.category.toLowerCase().trim()) ?? null)
        : null,
      store_location: row.store_location ?? null,
      reorder_level: row.reorder_level,
      min_level: 0,
      status: row.status,
      tax_percent: row.tax_percent ?? 0,
    }

    if (existingId) {
      if (resolution?.action === 'overwrite' && !seenFPs.has(fp)) {
        seenFPs.add(fp)
        upsertPayloads.push({
          ...payload,
          id: existingId,
          updated_at: new Date().toISOString(),
        })
      } else {
        skipped++
      }
    } else if (!seenFPs.has(fp)) {
      seenFPs.add(fp)
      insertPayloads.push(payload)
    }
  }

  return { insertPayloads, upsertPayloads, skipped }
}

/**
 * Inserts one pre-built batch of new medicines. Called repeatedly by the
 * client so it can update a progress bar between each await.
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

/**
 * Upserts one pre-built batch of existing medicines (overwrite path).
 * Payloads must include the `id` field.
 */
export async function upsertMedicineBatchAction(
  payloads: Array<Record<string, unknown>>,
): Promise<{ updated: number; error?: string }> {
  if (!payloads.length) return { updated: 0 }
  const supabase = await createClient()
  const { error } = await supabase
    .from('medicines')
    .upsert(payloads, { onConflict: 'id' })
  if (error) return { updated: 0, error: error.message }
  return { updated: payloads.length }
}

/** Called once after all batches complete to flush the Next.js cache. */
export async function finalizeMedicinesImportAction(): Promise<void> {
  revalidatePath('/medicines')
}

export async function getMedicineCategoryNamesAction(): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('branch_id')
    .eq('auth_user_id', user?.id ?? '')
    .single()
  const { data: cats } = await supabase
    .from('medicine_categories')
    .select('name')
    .eq('branch_id', profile?.branch_id ?? '')
    .eq('is_active', true)
    .order('name')
  return (cats ?? []).map((c) => c.name)
}
