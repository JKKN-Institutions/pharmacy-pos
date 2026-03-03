import { useState, useCallback, useRef } from 'react'
import { db } from '@/lib/offline/db'

export interface MedicineResult {
  id: string
  name: string
  company: string | null
  tax_percent: number
  batches: Array<{
    id: string
    batch_no: string
    expiry_date: string
    sale_price: number
    available_qty: number
  }>
}

const ONLINE_DEBOUNCE_MS = 150
const MIN_QUERY_LENGTH = 2

export function useMedicineSearch() {
  const [query, setQueryState] = useState('')
  const [results, setResults] = useState<MedicineResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [noResults, setNoResults] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const setQuery = useCallback((q: string) => {
    setQueryState(q)
    setNoResults(false)

    // Cancel pending online request
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    if (q.length < MIN_QUERY_LENGTH) {
      setResults([])
      setIsSearching(false)
      return
    }

    // ── Instant local search (0ms debounce) ──
    // Uses WhereClause.startsWith() on the name_lower index — sub-millisecond
    const lower = q.toLowerCase()
    db.medicines
      .where('name_lower')
      .startsWith(lower)
      .limit(20)
      .toArray()
      .then(localResults => {
        // Also do a secondary filter for company matches + substring matches
        // that startsWith() misses (e.g. "cetam" inside "Paracetamol")
        return db.medicines
          .filter(m =>
            (m.name_lower ?? m.name.toLowerCase()).includes(lower) ||
            (m.company?.toLowerCase()?.includes(lower) ?? false)
          )
          .limit(20)
          .toArray()
          .then(filterResults => {
            // Merge: startsWith results first, then filter results (deduplicated)
            const seen = new Set(localResults.map(m => m.id))
            const merged = [...localResults]
            for (const r of filterResults) {
              if (!seen.has(r.id)) {
                seen.add(r.id)
                merged.push(r)
              }
            }
            return merged.slice(0, 20)
          })
      })
      .then(localMedicines => {
        const mapped = localMedicines.map(m => ({
          id: m.id,
          name: m.name,
          company: m.company ?? null,
          tax_percent: Number(m.tax_percent ?? 0),
          batches: (m.batches ?? []).filter(b => b.available_qty > 0),
        }))

        // Show local results immediately
        setResults(mapped)
        setNoResults(mapped.length === 0)
      })
      .catch(() => {
        // IndexedDB error — continue to online search
      })

    // ── Debounced online search (150ms) ──
    if (navigator.onLine) {
      setIsSearching(true)
      debounceRef.current = setTimeout(async () => {
        const controller = new AbortController()
        abortRef.current = controller

        try {
          const res = await fetch(
            `/api/pos/search?q=${encodeURIComponent(q)}`,
            { signal: controller.signal }
          )

          if (res.ok) {
            const json = await res.json()
            const apiMedicines: MedicineResult[] = json.medicines ?? []

            // Only update if this is still the current query
            // (abort would have thrown if user typed again)
            setResults(apiMedicines)
            setNoResults(apiMedicines.length === 0)
          }
        } catch (err: any) {
          // AbortError means user typed again — ignore
          if (err?.name !== 'AbortError') {
            // API failed — local results are already showing, just stop spinner
          }
        } finally {
          setIsSearching(false)
        }
      }, ONLINE_DEBOUNCE_MS)
    }
  }, [])

  const clear = useCallback(() => {
    setQueryState('')
    setResults([])
    setNoResults(false)
    setIsSearching(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()
  }, [])

  return { query, setQuery, results, isSearching, noResults, clear }
}
