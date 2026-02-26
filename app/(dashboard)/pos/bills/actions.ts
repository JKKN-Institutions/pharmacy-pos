'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { PosBillItem } from '@/lib/types/database'

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

  // Delete bill items first (cascade may handle this, but explicit is safer)
  const { error: itemsError } = await supabase
    .from('pos_bill_items')
    .delete()
    .eq('bill_id', id)

  if (itemsError) {
    // If table doesn't exist or already handled by cascade, continue
    console.warn('Could not delete bill items:', itemsError.message)
  }

  const { error } = await supabase
    .from('pos_bills')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/pos/bills')
  revalidatePath('/pos')
  return { success: true }
}
