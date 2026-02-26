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
  const { data: branch } = await supabase.from('branches').select('id').limit(1).single()
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('id')
    .limit(1)
    .single()

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
      branch_id: branch?.id,
      created_by: userProfile?.id,
    })
    .select('id')
    .single()

  if (purchaseError) return { error: purchaseError.message }

  // 2. Create purchase line items
  const { error: itemsError } = await supabase.from('purchase_items').insert(
    data.items.map(item => ({ ...item, purchase_id: purchase.id }))
  )
  if (itemsError) return { error: itemsError.message }

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
      branch_id: branch?.id,
    }))
  )
  if (stockError) return { error: stockError.message }

  revalidatePath('/purchases')
  revalidatePath('/stock')
  redirect('/purchases')
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

export async function bulkImportPurchasesAction(rows: BulkPurchaseRow[]): Promise<{
  inserted: number
  skipped: number
  errors: string[]
}> {
  if (!rows.length) return { inserted: 0, skipped: 0, errors: [] }

  const supabase = await createClient()

  const { data: branch } = await supabase.from('branches').select('id').limit(1).single()
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('id')
    .limit(1)
    .single()

  const branchId = branch?.id ?? null
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

export async function deletePurchaseAction(id: string) {
  const supabase = await createClient()

  // Get associated stock batches to remove them
  const { error: stockError } = await supabase
    .from('stock_batches')
    .delete()
    .eq('purchase_id', id)

  if (stockError) return { error: stockError.message }

  const { error } = await supabase.from('purchases').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/purchases')
  revalidatePath('/stock')
  return { success: true }
}
