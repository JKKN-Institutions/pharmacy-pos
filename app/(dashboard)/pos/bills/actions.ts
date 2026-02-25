'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
