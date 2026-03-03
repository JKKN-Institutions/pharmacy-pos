'use client'

import { useState, useCallback, useRef } from 'react'
import { db } from '@/lib/offline/db'
import { Input } from '@/components/ui/input'
import { Search, Package, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import type { BillItem } from './pos-client'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { syncMedicines } from '@/lib/offline/sync'

interface MedicineSearchProps {
  onAddItem: (item: BillItem) => void
  isSyncing?: boolean
}

export function MedicineSearch({ onAddItem, isSyncing = false }: MedicineSearchProps) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [noResults, setNoResults] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resyncing, setResyncing] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback((query: string) => {
    setSearch(query)
    setNoResults(false)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        let medicines: any[] = []

        if (navigator.onLine) {
          // ── Online: live search directly from Supabase via API ──────────────
          const res = await fetch(`/api/pos/search?q=${encodeURIComponent(query)}`)
          if (res.ok) {
            const json = await res.json()
            medicines = json.medicines ?? []
          } else {
            // API failed — fall back to IndexedDB
            medicines = await searchIndexedDB(query)
          }
        } else {
          // ── Offline: search cached IndexedDB ────────────────────────────────
          medicines = await searchIndexedDB(query)
        }

        setResults(medicines)
        setOpen(medicines.length > 0)
        setNoResults(medicines.length === 0)
      } catch (err) {
        console.error('Medicine search error:', err)
        setResults([])
        setOpen(false)
        setNoResults(true)
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  async function searchIndexedDB(query: string): Promise<any[]> {
    const q = query.toLowerCase()
    return db.medicines
      .filter(
        m =>
          m.name.toLowerCase().includes(q) ||
          (m.company?.toLowerCase()?.includes(q) ?? false),
      )
      .limit(10)
      .toArray()
  }

  async function handleResync() {
    setResyncing(true)
    const ok = await syncMedicines()
    setResyncing(false)
    if (ok) {
      toast.success('Medicine catalog synced — try searching again')
      if (search.length >= 2) handleSearch(search)
    } else {
      toast.error('Sync failed. Check your connection.')
    }
  }

  function handleSelectBatch(medicine: any, batch: any) {
    const salePrice = Number(batch.sale_price)
    const item: BillItem = {
      id: crypto.randomUUID(),
      medicine_id: medicine.id,
      medicine_name: medicine.name,
      stock_batch_id: batch.id,
      batch_no: batch.batch_no,
      expiry_date: batch.expiry_date,
      available_qty: Number(batch.available_qty),
      qty: 1,
      sale_price: salePrice,
      discount_type: 'percent',
      discount_value: 0,
      tax: Number(medicine.tax_percent ?? 0),
      price: salePrice,
    }
    onAddItem(item)
    setSearch('')
    setResults([])
    setOpen(false)
    setNoResults(false)
  }

  const syncing = isSyncing || resyncing
  const busy = syncing || loading

  return (
    <div className="relative">
      <div className="relative">
        {busy ? (
          <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin pointer-events-none" />
        ) : (
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        )}
        <Input
          value={search}
          onChange={e => !syncing && handleSearch(e.target.value)}
          placeholder={
            syncing
              ? 'Syncing medicine catalog, please wait...'
              : 'Search medicine by name or company to add to bill...'
          }
          disabled={syncing}
          className="pl-10 h-12 text-sm bg-card border-2 focus-visible:border-primary rounded-xl shadow-sm disabled:opacity-70"
          autoFocus={!syncing}
        />
        {search && !syncing && (
          <button
            onClick={() => {
              setSearch('')
              setResults([])
              setOpen(false)
              setNoResults(false)
            }}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown: results — each medicine expands to show all its batches */}
      {open && results.length > 0 && !syncing && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-popover border border-border rounded-xl shadow-xl overflow-hidden max-h-[60vh] overflow-y-auto">
          <div className="px-3 py-1.5 border-b bg-muted/40 sticky top-0">
            <p className="text-xs text-muted-foreground font-medium">
              {results.length} medicine{results.length !== 1 ? 's' : ''} — select a batch to add
            </p>
          </div>

          {results.map(medicine => {
            const availableBatches = (medicine.batches ?? [])
              .filter((b: any) => b.available_qty > 0)
              .sort((a: any, b: any) =>
                new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
              )
            const isOutOfStock = availableBatches.length === 0

            return (
              <div key={medicine.id} className="border-b border-border/60 last:border-b-0">

                {/* Medicine header — name + company */}
                <div className="flex items-center gap-3 px-4 py-2 bg-muted/30">
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    {isOutOfStock
                      ? <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                      : <Package className="w-3.5 h-3.5 text-primary" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{medicine.name}</div>
                    <div className="text-xs text-muted-foreground">{medicine.company ?? 'Unknown company'}</div>
                  </div>
                  {isOutOfStock && (
                    <Badge variant="destructive" className="text-xs shrink-0">Out of stock</Badge>
                  )}
                </div>

                {/* Batch rows — one clickable row per available batch */}
                {isOutOfStock ? null : availableBatches.map((batch: any, idx: number) => (
                  <button
                    key={batch.id}
                    onClick={() => handleSelectBatch(medicine, batch)}
                    className="w-full text-left px-4 py-2 hover:bg-primary/5 transition-colors border-t border-border/40 flex items-center gap-3"
                  >
                    {/* FEFO indicator on the first (nearest-expiry) batch */}
                    <span className="w-12 shrink-0">
                      {idx === 0 ? (
                        <span className="text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded uppercase tracking-wide">
                          FEFO
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/50 pl-1">#{idx + 1}</span>
                      )}
                    </span>

                    {/* Batch number */}
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0 text-muted-foreground">
                      {batch.batch_no}
                    </span>

                    {/* Expiry */}
                    <span className="text-xs text-muted-foreground shrink-0">
                      Exp: {new Date(batch.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                    </span>

                    {/* Available qty */}
                    <span className="text-xs text-muted-foreground shrink-0">
                      Qty: <span className="font-medium text-foreground">{batch.available_qty}</span>
                    </span>

                    {/* Sale price — right-aligned */}
                    <span className="ml-auto text-sm font-semibold tabular-nums">
                      ₹{Number(batch.sale_price).toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* No results — offer resync (only relevant in offline mode) */}
      {noResults && search.length >= 2 && !syncing && !loading && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="px-4 py-4 flex flex-col items-center gap-2 text-center">
            <AlertCircle className="w-5 h-5 text-muted-foreground opacity-50" />
            <p className="text-sm font-medium text-muted-foreground">
              No medicines found for &quot;{search}&quot;
            </p>
            {!navigator.onLine && (
              <>
                <p className="text-xs text-muted-foreground/70">
                  You&apos;re offline. The catalog may be outdated.
                </p>
                <button
                  onClick={handleResync}
                  disabled={resyncing}
                  className="mt-1 flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${resyncing ? 'animate-spin' : ''}`} />
                  Sync catalog and retry
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
