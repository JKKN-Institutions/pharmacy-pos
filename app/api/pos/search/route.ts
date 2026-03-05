import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ medicines: [] })
  }

  const supabase = await createClient()

  // ── Strategy: FTS first (uses GIN index), ilike fallback for substring matches ──
  let medicines = await searchFTS(supabase, q)

  // FTS requires word-prefix matching. If it returns nothing, fall back to
  // ilike which handles mid-word matches like "cetam" → "Paracetamol"
  if (medicines.length === 0) {
    medicines = await searchIlike(supabase, q)
  }

  return NextResponse.json({ medicines })
}

async function searchFTS(supabase: any, query: string) {
  const today = new Date().toISOString().split('T')[0]
  // Single embedded-join query using textSearch() — hits the GIN index
  const { data, error } = await supabase
    .from('medicines')
    .select(`
      id, name, company, tax_percent,
      stock_batches!inner(id, batch_no, expiry_date, sale_price, available_qty)
    `)
    .eq('status', 'active')
    .textSearch('name', query, { type: 'websearch' })
    .eq('stock_batches.status', 'active')
    .gte('stock_batches.expiry_date', today)
    .gt('stock_batches.available_qty', 0)
    .order('name')
    .limit(20)

  if (error) {
    console.error('[search] FTS query failed:', error.message)
    return []
  }

  return formatResults(data)
}

async function searchIlike(supabase: any, query: string) {
  const today = new Date().toISOString().split('T')[0]
  // Fallback: ilike with embedded join — handles substring matches
  const { data, error } = await supabase
    .from('medicines')
    .select(`
      id, name, company, tax_percent,
      stock_batches!inner(id, batch_no, expiry_date, sale_price, available_qty)
    `)
    .eq('status', 'active')
    .or(`name.ilike.%${query}%,company.ilike.%${query}%`)
    .eq('stock_batches.status', 'active')
    .gte('stock_batches.expiry_date', today)
    .gt('stock_batches.available_qty', 0)
    .order('name')
    .limit(20)

  if (error) {
    console.error('[search] ilike query failed:', error.message)
    return []
  }

  return formatResults(data)
}

function formatResults(data: any[] | null) {
  return (data ?? []).map((m: any) => ({
    id: m.id,
    name: m.name,
    company: m.company ?? null,
    tax_percent: Number(m.tax_percent ?? 0),
    batches: ((m.stock_batches ?? []) as any[])
      .sort((a, b) => (a.expiry_date as string).localeCompare(b.expiry_date as string))
      .map((b) => ({
        id: b.id,
        batch_no: b.batch_no,
        expiry_date: b.expiry_date,
        sale_price: Number(b.sale_price),
        available_qty: Number(b.available_qty),
      })),
  }))
}
