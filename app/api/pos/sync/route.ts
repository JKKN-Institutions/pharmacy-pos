import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: medicines } = await supabase
    .from('medicines')
    .select(`
      id,
      name,
      company,
      stock_batches!inner(
        id,
        batch_no,
        expiry_date,
        sale_price,
        available_qty
      )
    `)
    .eq('status', 'active')
    .gt('stock_batches.available_qty', 0)
    .order('name')

  return NextResponse.json({
    medicines: medicines ?? [],
    synced_at: new Date().toISOString(),
  })
}
