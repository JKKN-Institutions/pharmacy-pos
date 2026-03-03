import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  // Single embedded-join query — avoids a huge .in('medicine_id', ids) URL that
  // overflows HTTP URL limits when the catalogue has 1000+ medicines.
  const { data, error } = await supabase
    .from('medicines')
    .select(`
      id, name, company, tax_percent,
      stock_batches!stock_batches_medicine_id_fkey(
        id, batch_no, expiry_date, sale_price, available_qty
      )
    `)
    .eq('status', 'active')
    .order('name')

  if (error) {
    console.error('[sync] query failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const medicines = (data ?? []).map((m: any) => ({
    id: m.id,
    name: m.name,
    company: m.company ?? null,
    tax_percent: Number(m.tax_percent ?? 0),
    // Filter and sort batches in JS — PostgREST embedded filters have caveats
    batches: ((m.stock_batches ?? []) as any[])
      .filter((b) => Number(b.available_qty) > 0)
      .sort((a, b) => (a.expiry_date as string).localeCompare(b.expiry_date as string))
      .map((b) => ({
        id: b.id,
        batch_no: b.batch_no,
        expiry_date: b.expiry_date,
        sale_price: Number(b.sale_price),
        available_qty: Number(b.available_qty),
      })),
  }))

  return NextResponse.json({
    medicines,
    synced_at: new Date().toISOString(),
  })
}
