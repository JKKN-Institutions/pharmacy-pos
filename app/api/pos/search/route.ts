import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ medicines: [] })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
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
    .or(`name.ilike.%${q}%,company.ilike.%${q}%`)
    .order('name')
    .limit(10)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Normalise: map stock_batches → batches (same shape as IndexedDB offline cache)
  const medicines = (data ?? []).map((m: any) => ({
    id: m.id,
    name: m.name,
    company: m.company ?? null,
    tax_percent: 0,
    batches: (m.stock_batches ?? []).filter((b: any) => b.available_qty > 0),
  }))

  return NextResponse.json({ medicines })
}
