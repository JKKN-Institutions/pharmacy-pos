'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export interface PurchaseItemInput {
  medicine_id: string
  batch_no: string
  expiry_date: string
  packing_qty: number
  quantity: number
  free_qty: number
  total_qty: number
  purchase_price: number
  sale_price: number
  discount_type: 'percent' | 'flat'
  discount_value: number
  tax: number
  price: number
}

export async function createPurchaseAction(data: {
  supplier_id: string
  invoice_no: string
  purchase_date: string
  items: PurchaseItemInput[]
  subtotal: number
  discount: number
  tax: number
  total: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('id, branch_id')
    .eq('auth_user_id', user?.id ?? '')
    .single()

  const branchId  = userProfile?.branch_id ?? null
  const createdBy = userProfile?.id ?? null

  // 1. Create purchase header
  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .insert({
      supplier_id: data.supplier_id,
      invoice_no: data.invoice_no,
      purchase_date: data.purchase_date,
      subtotal: data.subtotal,
      discount: data.discount,
      tax: data.tax,
      total: data.total,
      status: 'received',
      branch_id: branchId,
      created_by: createdBy,
    })
    .select('id')
    .single()

  if (purchaseError) return { error: purchaseError.message }

  // 2. Create purchase line items — only send columns that exist in the DB table.
  // (The form item object also carries computed-only fields like item_subtotal /
  //  item_discount / item_tax which must NOT be forwarded to Supabase.)
  const { error: itemsError } = await supabase.from('purchase_items').insert(
    data.items.map(item => ({
      purchase_id:    purchase.id,
      medicine_id:    item.medicine_id,
      batch_no:       item.batch_no,
      expiry_date:    item.expiry_date,
      packing_qty:    item.packing_qty,
      quantity:       item.quantity,
      free_qty:       item.free_qty,
      total_qty:      item.total_qty,
      purchase_price: item.purchase_price,
      sale_price:     item.sale_price,
      discount_type:  item.discount_type,
      discount_value: item.discount_value,
      tax:            item.tax,
      price:          item.price,
    }))
  )
  if (itemsError) {
    // Rollback orphaned purchase header
    await supabase.from('purchases').delete().eq('id', purchase.id)
    return { error: `Failed to save purchase items: ${itemsError.message}` }
  }

  // 3. Create stock batches — this is the critical stock update
  const { error: stockError } = await supabase.from('stock_batches').insert(
    data.items.map(item => ({
      medicine_id: item.medicine_id,
      purchase_id: purchase.id,
      batch_no: item.batch_no,
      expiry_date: item.expiry_date,
      purchase_price: item.purchase_price,
      sale_price: item.sale_price,
      initial_qty: item.total_qty,
      sold_qty: 0,
      available_qty: item.total_qty,
      status: 'active',
      branch_id: branchId,
    }))
  )
  if (stockError) {
    // Rollback both header and items
    await supabase.from('purchase_items').delete().eq('purchase_id', purchase.id)
    await supabase.from('purchases').delete().eq('id', purchase.id)
    return { error: `Failed to update stock: ${stockError.message}` }
  }

  revalidatePath('/purchases')
  revalidatePath('/stock')
  redirect('/purchases')
}

// ─── Update Purchase ─────────────────────────────────────────────────────────

export async function updatePurchaseAction(
  purchaseId: string,
  data: {
    supplier_id: string
    invoice_no: string
    purchase_date: string
    items: PurchaseItemInput[]
    subtotal: number
    discount: number
    tax: number
    total: number
  },
) {
  if (!purchaseId) return { error: 'Purchase ID is required' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('id, branch_id')
    .eq('auth_user_id', user?.id ?? '')
    .single()

  const branchId = userProfile?.branch_id ?? null

  // 0. Verify purchase exists
  const { data: existing } = await supabase
    .from('purchases')
    .select('id')
    .eq('id', purchaseId)
    .single()
  if (!existing) return { error: 'Purchase not found' }

  // 1. Safety check — block edit if any stock batch from this purchase has been sold
  const { data: soldBatches } = await supabase
    .from('stock_batches')
    .select('id, batch_no, sold_qty')
    .eq('purchase_id', purchaseId)
    .gt('sold_qty', 0)

  if (soldBatches && soldBatches.length > 0) {
    const batchNos = soldBatches.map(b => b.batch_no).join(', ')
    return {
      error: `Cannot edit: batches already sold through POS (${batchNos}). Cancel related bills first.`,
    }
  }

  // 2. Delete old stock batches (safe — sold_qty is 0 for all)
  const { error: delStockErr } = await supabase
    .from('stock_batches')
    .delete()
    .eq('purchase_id', purchaseId)
  if (delStockErr) return { error: `Failed to update stock: ${delStockErr.message}` }

  // 3. Delete old purchase items
  await supabase.from('purchase_items').delete().eq('purchase_id', purchaseId)

  // 4. Update purchase header
  const { error: headerErr } = await supabase
    .from('purchases')
    .update({
      supplier_id: data.supplier_id,
      invoice_no: data.invoice_no,
      purchase_date: data.purchase_date,
      subtotal: data.subtotal,
      discount: data.discount,
      tax: data.tax,
      total: data.total,
    })
    .eq('id', purchaseId)
  if (headerErr) return { error: headerErr.message }

  // 5. Insert updated purchase items
  const { error: itemsErr } = await supabase.from('purchase_items').insert(
    data.items.map(item => ({
      purchase_id:    purchaseId,
      medicine_id:    item.medicine_id,
      batch_no:       item.batch_no,
      expiry_date:    item.expiry_date,
      packing_qty:    item.packing_qty,
      quantity:       item.quantity,
      free_qty:       item.free_qty,
      total_qty:      item.total_qty,
      purchase_price: item.purchase_price,
      sale_price:     item.sale_price,
      discount_type:  item.discount_type,
      discount_value: item.discount_value,
      tax:            item.tax,
      price:          item.price,
    })),
  )
  if (itemsErr) return { error: `Failed to save items: ${itemsErr.message}` }

  // 6. Re-create stock batches
  const { error: stockErr } = await supabase.from('stock_batches').insert(
    data.items.map(item => ({
      medicine_id:    item.medicine_id,
      purchase_id:    purchaseId,
      batch_no:       item.batch_no,
      expiry_date:    item.expiry_date,
      purchase_price: item.purchase_price,
      sale_price:     item.sale_price,
      initial_qty:    item.total_qty,
      sold_qty:       0,
      available_qty:  item.total_qty,
      status:         'active' as const,
      branch_id:      branchId,
    })),
  )
  if (stockErr) return { error: `Failed to update stock: ${stockErr.message}` }

  revalidatePath('/purchases')
  revalidatePath(`/purchases/${purchaseId}`)
  revalidatePath(`/purchases/${purchaseId}/edit`)
  revalidatePath('/stock')
  redirect(`/purchases/${purchaseId}`)
}

// ─── Bulk Import ──────────────────────────────────────────────────────────────

export interface BulkPurchaseRow {
  supplier_name: string
  subtotal: number
  tax: number
  discount: number
  total: number
  purchase_date: string  // ISO YYYY-MM-DD
  raw_row: number
}

/**
 * Bulk-imports purchase HEADERS only from a legacy CSV export.
 *
 * ⚠️  This action does NOT create `purchase_items` or `stock_batches`.
 * The source CSV contains only summary totals per purchase — no per-medicine
 * line items (batch_no, expiry_date, sale_price, qty) are available in the file.
 *
 * Consequence: medicines from bulk-imported purchases will NOT appear in POS
 * search until a proper purchase with line items is created for each medicine.
 *
 * Use this action only for migrating historical financial records. For live
 * stock, create purchases via the manual purchase form which creates
 * stock_batches immediately.
 */
export async function bulkImportPurchasesAction(rows: BulkPurchaseRow[]): Promise<{
  inserted: number
  skipped: number
  errors: string[]
}> {
  if (!rows.length) return { inserted: 0, skipped: 0, errors: [] }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('id, branch_id')
    .eq('auth_user_id', user?.id ?? '')
    .single()

  const branchId  = userProfile?.branch_id ?? null
  const createdBy = userProfile?.id ?? null

  // Load all existing suppliers once (avoid N+1 queries)
  const { data: existingSuppliers } = await supabase
    .from('suppliers')
    .select('id, name')

  // Build name → id map (case-insensitive)
  const supplierMap = new Map<string, string>(
    (existingSuppliers ?? []).map((s) => [s.name.toLowerCase().trim(), s.id]),
  )

  const errors: string[] = []
  let inserted = 0
  let skipped = 0

  for (const row of rows) {
    try {
      const nameKey = row.supplier_name.toLowerCase().trim()
      let supplierId = supplierMap.get(nameKey)

      // Auto-create supplier if not found
      if (!supplierId) {
        const { data: newSupplier, error: supplierError } = await supabase
          .from('suppliers')
          .insert({
            name: row.supplier_name.trim(),
            branch_id: branchId,
          })
          .select('id')
          .single()

        if (supplierError || !newSupplier) {
          errors.push(`Row ${row.raw_row}: Failed to create supplier "${row.supplier_name}" — ${supplierError?.message}`)
          skipped++
          continue
        }

        // Use a const so TypeScript sees a narrowed `string`, not `string | undefined`
        const newId = newSupplier.id
        supplierId = newId
        supplierMap.set(nameKey, newId)
      }

      // Auto-generate invoice number: IMP-YYYYMMDD-NNN
      const datePart = row.purchase_date.replace(/-/g, '')
      const invoice_no = `IMP-${datePart}-${String(row.raw_row).padStart(3, '0')}`

      const { error: purchaseError } = await supabase.from('purchases').insert({
        supplier_id: supplierId,
        invoice_no,
        purchase_date: row.purchase_date,
        subtotal: row.subtotal,
        discount: row.discount,
        tax: row.tax,
        total: row.total,
        status: 'received',
        branch_id: branchId,
        created_by: createdBy,
      })

      if (purchaseError) {
        errors.push(`Row ${row.raw_row}: ${purchaseError.message}`)
        skipped++
        continue
      }

      inserted++
    } catch (e) {
      errors.push(`Row ${row.raw_row}: Unexpected error — ${(e as Error).message}`)
      skipped++
    }
  }

  revalidatePath('/purchases')
  return { inserted, skipped, errors }
}

export async function bulkDeletePurchasesAction(
  ids: string[],
): Promise<{ deleted: number; error?: string }> {
  if (!ids.length) return { deleted: 0 }

  const supabase = await createClient()

  // 1. Remove stock batches created by these purchases
  const { error: stockError } = await supabase
    .from('stock_batches')
    .delete()
    .in('purchase_id', ids)

  if (stockError) return { deleted: 0, error: stockError.message }

  // 2. Delete purchase line items
  await supabase.from('purchase_items').delete().in('purchase_id', ids)

  // 3. Delete purchase headers
  const { error } = await supabase.from('purchases').delete().in('id', ids)
  if (error) return { deleted: 0, error: error.message }

  revalidatePath('/purchases')
  revalidatePath('/stock')
  return { deleted: ids.length }
}

// ─── Supplier-specific last sale prices ──────────────────────────────────────

/**
 * Fetches the most recent sale_price for each medicine previously purchased
 * from a given supplier. Used to auto-suggest sale prices when creating a new
 * purchase from the same supplier.
 */
export async function getLastSalePricesBySupplierAction(
  supplierId: string,
): Promise<{ data: Record<string, number> }> {
  if (!supplierId) return { data: {} }

  const supabase = await createClient()

  // Get purchase IDs for this supplier, ordered by most recent first
  const { data: purchases } = await supabase
    .from('purchases')
    .select('id')
    .eq('supplier_id', supplierId)
    .order('purchase_date', { ascending: false })

  if (!purchases || purchases.length === 0) return { data: {} }

  const purchaseIds = purchases.map(p => p.id)

  // Get all purchase_items for those purchases
  const { data: rows } = await supabase
    .from('purchase_items')
    .select('medicine_id, sale_price, purchase_id')
    .in('purchase_id', purchaseIds)

  if (!rows || rows.length === 0) return { data: {} }

  // Build purchase_id → index map for ordering (lower index = more recent)
  const orderMap = new Map(purchaseIds.map((id, i) => [id, i]))

  // Sort by purchase recency then keep only the first (most recent) per medicine
  const sorted = [...rows].sort((a, b) => (orderMap.get(a.purchase_id) ?? 999) - (orderMap.get(b.purchase_id) ?? 999))

  const map: Record<string, number> = {}
  for (const row of sorted) {
    if (row.medicine_id && !(row.medicine_id in map)) {
      map[row.medicine_id] = Number(row.sale_price)
    }
  }

  return { data: map }
}

export async function deletePurchaseAction(id: string) {
  const supabase = await createClient()

  // 1. Remove stock batches created by this purchase
  const { error: stockError } = await supabase
    .from('stock_batches')
    .delete()
    .eq('purchase_id', id)

  if (stockError) return { error: stockError.message }

  // 2. Delete purchase line items (explicit cleanup regardless of DB cascade)
  await supabase.from('purchase_items').delete().eq('purchase_id', id)

  // 3. Delete purchase header
  const { error } = await supabase.from('purchases').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/purchases')
  revalidatePath('/stock')
  return { success: true }
}
