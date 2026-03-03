import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ medicines: [] })
  }

  const supabase = await createClient()

  // Step 1: Find matching active medicines by name or company
  // Split into two queries to avoid PostgREST !inner + .or() + .gt() conflicts
  const { data: medicineRows, error: medError } = await supabase
    .from('medicines')
    .select('id, name, company, tax_percent')
    .eq('status', 'active')
    .or(`name.ilike.%${q}%,company.ilike.%${q}%`)
    .order('name')
    .limit(20)

  if (medError) {
    return NextResponse.json({ error: medError.message }, { status: 500 })
  }

  if (!medicineRows || medicineRows.length === 0) {
    return NextResponse.json({ medicines: [] })
  }

  // Step 2: Fetch available batches for those medicines (FEFO order)
  const ids = medicineRows.map((m) => m.id)
  const { data: batchRows, error: batchError } = await supabase
    .from('stock_batches')
    .select('id, medicine_id, batch_no, expiry_date, sale_price, available_qty')
    .in('medicine_id', ids)
    .gt('available_qty', 0)
    .order('expiry_date', { ascending: true })

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 500 })
  }

  // Group batches by medicine_id
  const batchMap: Record<string, any[]> = {}
  for (const b of batchRows ?? []) {
    if (!batchMap[b.medicine_id]) batchMap[b.medicine_id] = []
    batchMap[b.medicine_id].push({
      id: b.id,
      batch_no: b.batch_no,
      expiry_date: b.expiry_date,
      sale_price: Number(b.sale_price),
      available_qty: Number(b.available_qty),
    })
  }

  // Build response — only include medicines that have available stock
  const medicines = medicineRows
    .map((m) => ({
      id: m.id,
      name: m.name,
      company: m.company ?? null,
      tax_percent: Number(m.tax_percent ?? 0),
      batches: batchMap[m.id] ?? [],
    }))
    .filter((m) => m.batches.length > 0)

  return NextResponse.json({ medicines })
}
