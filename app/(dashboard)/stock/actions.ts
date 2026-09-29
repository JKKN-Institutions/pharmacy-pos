'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/queries'
import type { ParsedStockBatchRow } from '@/lib/utils/parse-stock-batches-excel'

// ─── Write Off ────────────────────────────────────────────────────────────────

export async function writeOffStockAction(batchId: string, reason: string) {
  const supabase = await createClient()

  const { data: batch, error: fetchError } = await supabase
    .from('stock_batches')
    .select('*')
    .eq('id', batchId)
    .single()

  if (fetchError || !batch) return { error: 'Batch not found' }

  const { error: updateError } = await supabase
    .from('stock_batches')
    .update({ status: 'written_off', available_qty: 0 })
    .eq('id', batchId)

  if (updateError) return { error: updateError.message }

  const { data: branch } = await supabase.from('branches').select('id').limit(1).single()
  await supabase.from('expenses').insert({
    name: `Stock Write-Off: Batch ${batch.batch_no}`,
    expense_type: 'Stock Write-off',
    amount: batch.purchase_price * batch.available_qty,
    method: 'cash',
    date: new Date().toISOString().split('T')[0],
    description: reason,
    branch_id: branch?.id,
  })

  revalidatePath('/stock')
  revalidatePath('/expenses')
  return { success: true }
}

// ─── Update Stock Batch ───────────────────────────────────────────────────────

export async function updateStockBatchAction(
  batchId: string,
  data: { available_qty: number; sale_price: number },
) {
  const supabase = await createClient()

  const { data: batch, error: fetchError } = await supabase
    .from('stock_batches')
    .select('initial_qty')
    .eq('id', batchId)
    .single()

  if (fetchError || !batch) return { error: 'Batch not found' }

  if (data.available_qty < 0) return { error: 'Available qty cannot be negative' }
  if (data.sale_price < 0) return { error: 'Sale price cannot be negative' }

  const newSoldQty = batch.initial_qty - data.available_qty
  if (newSoldQty < 0) return { error: 'Available qty cannot exceed initial qty' }

  const { error: updateError } = await supabase
    .from('stock_batches')
    .update({
      available_qty: data.available_qty,
      sold_qty: newSoldQty,
      sale_price: data.sale_price,
    })
    .eq('id', batchId)

  if (updateError) return { error: updateError.message }

  revalidatePath('/stock')
  return { success: true }
}

// ─── Edit Stock Batch (full) ──────────────────────────────────────────────────

export async function editStockBatchAction(
  batchId: string,
  data: {
    batch_no: string
    expiry_date: string
    purchase_price: number
    sale_price: number
    initial_qty: number
    available_qty: number
  },
) {
  const supabase = await createClient()

  const { data: batch, error: fetchError } = await supabase
    .from('stock_batches')
    .select('id, sold_qty')
    .eq('id', batchId)
    .single()

  if (fetchError || !batch) return { error: 'Batch not found' }

  if (!data.batch_no.trim()) return { error: 'Batch number is required' }
  if (!data.expiry_date) return { error: 'Expiry date is required' }
  if (data.purchase_price < 0) return { error: 'Purchase price cannot be negative' }
  if (data.sale_price < 0) return { error: 'Sale price cannot be negative' }
  if (data.initial_qty < 0) return { error: 'Initial qty cannot be negative' }
  if (data.available_qty < 0) return { error: 'Available qty cannot be negative' }
  if (data.available_qty > data.initial_qty) return { error: 'Available qty cannot exceed initial qty' }

  const newSoldQty = data.initial_qty - data.available_qty

  const { error: updateError } = await supabase
    .from('stock_batches')
    .update({
      batch_no: data.batch_no.trim(),
      expiry_date: data.expiry_date,
      purchase_price: data.purchase_price,
      sale_price: data.sale_price,
      initial_qty: data.initial_qty,
      available_qty: data.available_qty,
      sold_qty: newSoldQty,
    })
    .eq('id', batchId)

  if (updateError) return { error: updateError.message }

  revalidatePath('/stock')
  return { success: true }
}

// ─── Clean Import — Wipe stock_batches before re-import ──────────────────────

/**
 * Deletes ALL existing stock_batches for the current branch.
 * Does NOT delete medicines (they are referenced by purchase_items).
 * Does NOT delete purchases or purchase_items.
 *
 * This is safe because stock_batches are the "snapshot" layer —
 * the Excel live stock file replaces them entirely.
 */
export async function cleanWipeForReimportAction(): Promise<{
  deletedBatches: number
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { deletedBatches: 0, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('branch_id')
    .eq('auth_user_id', user.id)
    .single()
  if (!profile?.branch_id)
    return { deletedBatches: 0, error: 'Could not determine branch' }

  // Delete all stock_batches for this branch (purchases stay intact)
  const { count: batchCount, error: batchErr } = await supabase
    .from('stock_batches')
    .delete({ count: 'exact' })
    .eq('branch_id', profile.branch_id)

  if (batchErr) return { deletedBatches: 0, error: 'Failed to delete stock batches: ' + batchErr.message }

  revalidatePath('/stock')

  return { deletedBatches: batchCount ?? 0 }
}

// ─── Bulk Import — Step 1: Prepare payloads ───────────────────────────────────

/**
 * Resolves medicine names → IDs, checks for duplicate batch numbers,
 * and returns ready-to-insert payloads. Client calls this once, then
 * drives the insert loop itself (for progress updates).
 */
export async function prepareStockBatchImportAction(
  rows: ParsedStockBatchRow[],
): Promise<{
  payloads: Array<Record<string, unknown>>
  skipped: number
  notFound: string[]
  error?: string
}> {
  if (!rows.length) return { payloads: [], skipped: 0, notFound: [] }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { payloads: [], skipped: 0, notFound: [], error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('branch_id')
    .eq('auth_user_id', user.id)
    .single()
  if (!profile?.branch_id)
    return { payloads: [], skipped: 0, notFound: [], error: 'Could not determine branch' }

  const branchId = profile.branch_id

  // Build medicine name → id map from existing catalogue
  // Supports two matching strategies:
  //   1. Exact match: "AFENAK PLUS" → "AFENAK PLUS"
  //   2. Prefix match: "AFENAK PLUS" → "AFENAK PLUS Tablet" (DB has dosage-form suffix)
  const { data: medicines } = await supabase
    .from('medicines')
    .select('id, name')
    .eq('branch_id', branchId)

  // Known dosage-form suffixes appended by the old import system
  const KNOWN_SUFFIXES = new Set([
    'tablet', 'cream', 'capsule', 'injection', 'cosmetics', 'eyedrop',
    'paste', 'gel', 'drops', 'drop', 'oil', 'soap', 'syrup', 'diaper',
    'device', 'powder', 'ointment', 'lotion', 'suspension', 'solution',
    'spray', 'inhaler', 'patch', 'sachet',
  ])

  // exactMap: lowered name → id (for exact matches)
  const exactMap = new Map<string, string>()
  // suffixMap: lowered name WITHOUT suffix → id (for "AFENAK PLUS" → "AFENAK PLUS Tablet")
  const suffixMap = new Map<string, string>()

  for (const m of medicines ?? []) {
    const lower = m.name.toLowerCase().trim()
    exactMap.set(lower, m.id)

    // If DB name ends with a known suffix, also index the stripped version
    // "afenak plus tablet" → suffixMap["afenak plus"] = id
    const lastSpace = lower.lastIndexOf(' ')
    if (lastSpace > 0) {
      const lastWord = lower.slice(lastSpace + 1)
      if (KNOWN_SUFFIXES.has(lastWord)) {
        const stripped = lower.slice(0, lastSpace)
        // Only store first match to avoid ambiguity (e.g. don't overwrite)
        if (!suffixMap.has(stripped)) {
          suffixMap.set(stripped, m.id)
        }
      }
    }
  }

  /**
   * Resolve an Excel medicine name to an existing medicine ID.
   * Strategy:
   *   1. Exact match:  "AFENAK PLUS" → "AFENAK PLUS"
   *   2. Suffix match: "AFENAK PLUS" → "AFENAK PLUS Tablet" (safe, known suffix)
   *   3. Doubled name: "DYNAFIX" → "DYNAFIX  DYNAFIX" (legacy double-paste)
   */
  function findMedicineId(excelName: string): string | undefined {
    const lower = excelName.toLowerCase().trim()
    // 1. Exact match
    const exact = exactMap.get(lower)
    if (exact) return exact
    // 2. Suffix match: Excel "afenak plus" → DB "afenak plus tablet"
    const suffix = suffixMap.get(lower)
    if (suffix) return suffix
    // 3. Doubled name match: Excel "dynafix" → DB "dynafix  dynafix"
    const doubled = exactMap.get(lower + '  ' + lower)
    if (doubled) return doubled
    return undefined
  }

  // Collect unique Excel names that have no match in the catalogue
  const excelNames = [...new Set(rows.map((r) => r.medicine_name.trim()))]
  const missingNames = excelNames.filter((name) => !findMedicineId(name))

  // Auto-create missing medicines (ones not in catalogue at all)
  if (missingNames.length > 0) {
    const toCreate = missingNames.map((name) => ({
      branch_id:     branchId,
      name,
      status:        'active',
    }))

    // Insert in batches of 200 to stay within limits
    for (let i = 0; i < toCreate.length; i += 200) {
      const { data: created } = await supabase
        .from('medicines')
        .insert(toCreate.slice(i, i + 200))
        .select('id, name')
      for (const m of created ?? []) {
        const lower = m.name.toLowerCase().trim()
        exactMap.set(lower, m.id)
      }
    }
  }

  const payloads: Record<string, unknown>[] = []
  let skipped = 0
  const notFound: string[] = []

  for (const row of rows) {
    const medicineId = findMedicineId(row.medicine_name)
    if (!medicineId) {
      // Still not found after auto-create attempt (insert may have failed)
      if (!notFound.includes(row.medicine_name)) notFound.push(row.medicine_name)
      skipped++
      continue
    }

    payloads.push({
      branch_id: branchId,
      medicine_id: medicineId,
      batch_no: row.batch_number,
      expiry_date: row.expiry_date,
      purchase_price: row.purchase_price,
      sale_price: row.selling_price,
      initial_qty: row.qty,
      sold_qty: row.sold,
      available_qty: row.available,
      status: 'active',
    })
  }

  return { payloads, skipped, notFound }
}

// ─── Bulk Import — Step 2: Insert one batch ───────────────────────────────────

export async function insertStockBatchAction(
  payloads: Array<Record<string, unknown>>,
): Promise<{ inserted: number; error?: string }> {
  if (!payloads.length) return { inserted: 0 }
  const supabase = await createClient()
  const { error } = await supabase.from('stock_batches').insert(payloads)
  if (error) return { inserted: 0, error: error.message }
  return { inserted: payloads.length }
}

// ─── Export Live Stock ────────────────────────────────────────────────────────

export type LiveStockExportRow = {
  medicine_name:  string
  company:        string
  batch_no:       string
  expiry_date:    string
  purchase_price: number
  sale_price:     number
  initial_qty:    number
  sold_qty:       number
  available_qty:  number
}

/**
 * Fetches ALL live stock batches (active, not expired, available_qty > 0),
 * paginating past the 1000-row PostgREST cap.
 *   sortBy 'expiry' → FEFO order (nearest expiry first)
 *   sortBy 'name'   → alphabetical by medicine name, then nearest expiry
 */
export async function fetchLiveStockForExportAction(
  sortBy: 'expiry' | 'name',
): Promise<{ rows: LiveStockExportRow[]; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { rows: [], error: 'Not authenticated' }

  const today = new Date().toISOString().split('T')[0]

  type Raw = Omit<LiveStockExportRow, 'medicine_name' | 'company'> & {
    medicines: { name: string; company: string | null } | null
  }

  const raw = await fetchAllRows<Raw>(() =>
    supabase
      .from('stock_batches')
      .select('batch_no, expiry_date, purchase_price, sale_price, initial_qty, sold_qty, available_qty, medicines(name, company)')
      .eq('status', 'active')
      .gte('expiry_date', today)
      .gt('available_qty', 0)
      .order('expiry_date', { ascending: true })
      .order('id'),           // secondary sort — deterministic pagination
  )

  const rows: LiveStockExportRow[] = raw.map((r) => ({
    medicine_name:  r.medicines?.name?.trim() ?? '',
    company:        r.medicines?.company ?? '',
    batch_no:       r.batch_no,
    expiry_date:    r.expiry_date,
    purchase_price: Number(r.purchase_price) || 0,
    sale_price:     Number(r.sale_price) || 0,
    initial_qty:    Number(r.initial_qty) || 0,
    sold_qty:       Number(r.sold_qty) || 0,
    available_qty:  Number(r.available_qty) || 0,
  }))

  if (sortBy === 'name') {
    // Stable sort keeps FEFO (expiry asc) order within the same medicine name
    rows.sort((a, b) =>
      a.medicine_name.localeCompare(b.medicine_name, 'en', { sensitivity: 'base', numeric: true }),
    )
  }

  return { rows }
}

// ─── Bulk Import — Step 3: Revalidate cache ───────────────────────────────────

export async function finalizeStockImportAction(): Promise<void> {
  revalidatePath('/stock')
  revalidatePath('/medicines')
}
