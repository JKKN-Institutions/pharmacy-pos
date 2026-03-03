import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get('since')?.trim() || ''
  const supabase = await createClient()
  const synced_at = new Date().toISOString()

  if (since) {
    // ── Incremental sync: only records changed since last sync ──
    return incrementalSync(supabase, since, synced_at)
  }

  // ── Full sync: return entire active catalog ──
  return fullSync(supabase, synced_at)
}

async function fullSync(supabase: any, synced_at: string) {
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
    console.error('[sync] full query failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const medicines = formatMedicines(data)

  return NextResponse.json({
    medicines,
    deleted_ids: [],
    synced_at,
  })
}

async function incrementalSync(supabase: any, since: string, synced_at: string) {
  // Fetch medicines that were updated since last sync, OR have batches updated since last sync
  // We use two queries because PostgREST embedded filters can't OR across parent/child updated_at

  // 1. Medicines with updated_at > since (directly modified)
  const { data: updatedMedicines, error: medError } = await supabase
    .from('medicines')
    .select(`
      id, name, company, tax_percent, status,
      stock_batches!stock_batches_medicine_id_fkey(
        id, batch_no, expiry_date, sale_price, available_qty
      )
    `)
    .eq('status', 'active')
    .gt('updated_at', since)

  if (medError) {
    console.error('[sync] incremental medicines query failed:', medError.message)
    return NextResponse.json({ error: medError.message }, { status: 500 })
  }

  // 2. Medicines that have batches updated since last sync (stock changes)
  const { data: batchChangedMedicines, error: batchError } = await supabase
    .from('medicines')
    .select(`
      id, name, company, tax_percent, status,
      stock_batches!inner(
        id, batch_no, expiry_date, sale_price, available_qty
      )
    `)
    .eq('status', 'active')
    .gt('stock_batches.updated_at', since)

  if (batchError) {
    console.error('[sync] incremental batches query failed:', batchError.message)
    return NextResponse.json({ error: batchError.message }, { status: 500 })
  }

  // For batch-changed medicines, we need ALL their batches (not just changed ones)
  // Re-fetch complete batch data for these medicines
  const batchChangedIds = (batchChangedMedicines ?? []).map((m: any) => m.id)
  const alreadyFetchedIds = new Set((updatedMedicines ?? []).map((m: any) => m.id))
  const missingIds = batchChangedIds.filter((id: string) => !alreadyFetchedIds.has(id))

  let extraMedicines: any[] = []
  if (missingIds.length > 0) {
    const { data: extra } = await supabase
      .from('medicines')
      .select(`
        id, name, company, tax_percent, status,
        stock_batches!stock_batches_medicine_id_fkey(
          id, batch_no, expiry_date, sale_price, available_qty
        )
      `)
      .in('id', missingIds)
      .eq('status', 'active')

    extraMedicines = extra ?? []
  }

  // Merge all changed medicines (deduplicated)
  const allChanged = [...(updatedMedicines ?? []), ...extraMedicines]
  const medicines = formatMedicines(allChanged)

  // 3. Find medicines that became inactive since last sync (for deletion from IndexedDB)
  const { data: deactivated } = await supabase
    .from('medicines')
    .select('id')
    .eq('status', 'inactive')
    .gt('updated_at', since)

  const deleted_ids = (deactivated ?? []).map((m: any) => m.id)

  return NextResponse.json({
    medicines,
    deleted_ids,
    synced_at,
  })
}

function formatMedicines(data: any[] | null) {
  return (data ?? []).map((m: any) => ({
    id: m.id,
    name: m.name,
    company: m.company ?? null,
    tax_percent: Number(m.tax_percent ?? 0),
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
}
