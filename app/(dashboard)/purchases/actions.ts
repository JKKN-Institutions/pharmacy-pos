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
