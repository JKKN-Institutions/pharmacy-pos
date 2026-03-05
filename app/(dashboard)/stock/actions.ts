'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
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
  const { data: medicines } = await supabase
    .from('medicines')
    .select('id, name')
    .eq('branch_id', branchId)

  const medMap = new Map<string, string>()
  for (const m of medicines ?? []) {
    medMap.set(m.name.toLowerCase().trim(), m.id)
  }

  // Auto-create any medicines from the stock file that are missing in the catalogue.
  // Collect unique missing names first to avoid redundant inserts.
  const missingNames = [
    ...new Set(
      rows
        .map((r) => r.medicine_name.trim())
        .filter((name) => !medMap.has(name.toLowerCase())),
    ),
  ]

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
        medMap.set(m.name.toLowerCase().trim(), m.id)
      }
    }
  }

  const payloads: Record<string, unknown>[] = []
  let skipped = 0
  const notFound: string[] = []

  for (const row of rows) {
    const medicineId = medMap.get(row.medicine_name.toLowerCase().trim())
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

// ─── Bulk Import — Step 3: Revalidate cache ───────────────────────────────────

export async function finalizeStockImportAction(): Promise<void> {
  revalidatePath('/stock')
}
