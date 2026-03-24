import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Generic paginated fetch ─────────────────────────────────────────────────
// Supabase PostgREST caps responses at ~1000 rows by default.
// This helper paginates in chunks to fetch ALL matching rows.

const PAGE_SIZE = 1000

/**
 * Takes a Supabase query builder (before .range()) and fetches all rows
 * by paginating in chunks of 1000. The query MUST already have .select(),
 * any filters, and .order() applied — this only appends .range().
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryFn: () => { range(from: number, to: number): PromiseLike<{ data: any[] | null }> },
): Promise<T[]> {
  const all: T[] = []
  let from = 0

  while (true) {
    const { data } = await queryFn().range(from, from + PAGE_SIZE - 1)
    if (!data || data.length === 0) break
    all.push(...(data as T[]))
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return all
}

// ─── Medicine options (for dropdowns) ────────────────────────────────────────

type MedicineOption = {
  id: string
  name: string
  company: string | null
  unit: string | null
  tax_percent: number | null
}

export async function fetchAllActiveMedicines(
  supabase: SupabaseClient,
): Promise<MedicineOption[]> {
  return fetchAllRows<MedicineOption>(() =>
    supabase
      .from('medicines')
      .select('id, name, company, unit, tax_percent')
      .eq('status', 'active')
      .order('name')
      .order('id'),           // secondary sort — makes pagination deterministic at page boundaries
  )
}
