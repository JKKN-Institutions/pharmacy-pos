'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function writeOffStockAction(batchId: string, reason: string) {
  const supabase = await createClient()

  const { data: batch, error: fetchError } = await supabase
    .from('stock_batches')
    .select('*')
    .eq('id', batchId)
    .single()

  if (fetchError || !batch) return { error: 'Batch not found' }

  // Mark batch as written off
  const { error: updateError } = await supabase
    .from('stock_batches')
    .update({ status: 'written_off', available_qty: 0 })
    .eq('id', batchId)

  if (updateError) return { error: updateError.message }

  // Create expense entry for the stock loss
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
