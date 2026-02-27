'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function getBillItemsAction(billId: string) {
  if (!billId) return { data: null, error: 'Bill ID is required' }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pos_bill_items')
    .select('id, batch_no, qty, sale_price, price, medicines(name)')
    .eq('bill_id', billId)
    .order('id')
  if (error) return { data: null, error: error.message }
  return { data }
}

export async function deleteBillAction(id: string) {
  if (!id) return { error: 'Bill ID is required' }

  const supabase = await createClient()

  // 1. Fetch bill items BEFORE deleting — needed to restore stock
  const { data: billItems } = await supabase
    .from('pos_bill_items')
    .select('stock_batch_id, qty')
    .eq('bill_id', id)

  // 2. Restore stock for each line item
  if (billItems && billItems.length > 0) {
    for (const item of billItems) {
      if (!item.stock_batch_id) continue

      const { data: batch } = await supabase
        .from('stock_batches')
        .select('available_qty, sold_qty')
        .eq('id', item.stock_batch_id)
        .single()

      if (batch) {
        await supabase
          .from('stock_batches')
          .update({
            available_qty: Number(batch.available_qty) + Number(item.qty),
            sold_qty: Math.max(0, Number(batch.sold_qty) - Number(item.qty)),
          })
          .eq('id', item.stock_batch_id)
      }
    }
  }

  // 3. Delete line items
  const { error: itemsError } = await supabase
    .from('pos_bill_items')
    .delete()
    .eq('bill_id', id)

  if (itemsError) {
    console.warn('Could not delete bill items:', itemsError.message)
  }

  // 4. Delete the bill
  const { error } = await supabase
    .from('pos_bills')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/pos/bills')
  revalidatePath('/pos')
  revalidatePath('/stock')
  return { success: true }
}
