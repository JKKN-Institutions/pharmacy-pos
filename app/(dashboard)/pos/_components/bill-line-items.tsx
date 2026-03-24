'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { format } from 'date-fns'
import type { BillItem } from './pos-client'
import { useMedicineSearch, type MedicineResult } from '@/lib/hooks/use-medicine-search'
import { cn } from '@/lib/utils'

interface TaxRate {
  id: string
  name: string
  rate: number
}

type BatchOption = MedicineResult['batches'][number]

// ── Phase 1: Medicine search combobox ────────────────────────────────────────
// Selects a medicine only — batch is chosen separately in Phase 2.
function MedicineCombobox({
  onSelect,
  disabled,
  externalRef,
}: {
  onSelect: (medicine: MedicineResult) => void
  disabled?: boolean
  externalRef?: React.RefObject<HTMLInputElement | null>
}) {
  const internalRef                        = useRef<HTMLInputElement | null>(null)
  const { query, setQuery, results, clear } = useMedicineSearch()
  const [dropdownPos, setDropdownPos]      = useState<{ top: number; left: number; width: number } | null>(null)
  const [open, setOpen]                    = useState(false)

  function mergeRef(el: HTMLInputElement | null) {
    internalRef.current = el
    if (externalRef) externalRef.current = el
  }

  function computePos() {
    const el = internalRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(300, rect.width) })
  }

  const hasResults = results.length > 0 && query.length >= 2
  if (hasResults && !open) { computePos(); setOpen(true) }
  else if (!hasResults && open) { setOpen(false) }

  function handleSelect(medicine: MedicineResult) {
    onSelect(medicine)
    clear()
    setOpen(false)
  }

  const dropdown =
    open && results.length > 0 && dropdownPos
      ? createPortal(
          <div
            style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
            className="bg-popover border border-border rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto"
          >
            {results.map((m) => {
              const today = new Date().toISOString().split('T')[0]
              const availableCount = (m.batches ?? []).filter(
                (b) => b.available_qty > 0 && b.expiry_date >= today,
              ).length
              const totalQty = (m.batches ?? [])
                .filter((b) => b.available_qty > 0 && b.expiry_date >= today)
                .reduce((s, b) => s + b.available_qty, 0)
              const isOutOfStock = availableCount === 0

              return (
                <button
                  key={m.id}
                  onMouseDown={() => !isOutOfStock && handleSelect(m)}
                  disabled={isOutOfStock}
                  className={cn(
                    'w-full text-left px-3 py-2 border-b border-border/50 last:border-b-0 transition-colors',
                    isOutOfStock
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-primary/5 cursor-pointer',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-semibold">{m.name}</span>
                      {m.company && (
                        <span className="text-xs text-muted-foreground ml-1.5">{m.company}</span>
                      )}
                    </div>
                    {isOutOfStock ? (
                      <span className="text-[10px] text-destructive shrink-0">Out of stock</span>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {availableCount} batch{availableCount !== 1 ? 'es' : ''}
                        </span>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                          Qty: {totalQty}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>,
          document.body,
        )
      : null

  return (
    <div className="relative">
      <Input
        ref={mergeRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={computePos}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={disabled ? 'Syncing...' : 'Search medicine...'}
        disabled={disabled}
        className="h-7 border-0 focus-visible:ring-0 shadow-none text-sm w-full min-w-[150px]"
      />
      {dropdown}
    </div>
  )
}

// ── Phase 2: Batch selection combobox ─────────────────────────────────────────
// Shown in the Batch No cell after a medicine is selected.
// Displays available batches for that medicine + allows free-text entry.
function BatchDropdown({
  batches,
  onSelect,
  autoFocus,
}: {
  batches: BatchOption[]
  onSelect: (batch: BatchOption) => void
  autoFocus?: boolean
}) {
  const [query, setQuery]              = useState('')
  const [open, setOpen]                = useState(false)
  const [dropdownPos, setDropdownPos]  = useState<{ top: number; left: number; width: number } | null>(null)
  const inputRef                       = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => { inputRef.current?.focus(); computePos(); setOpen(true) }, 50)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus])

  function computePos() {
    const el = inputRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(280, rect.width) })
  }

  const today = new Date().toISOString().split('T')[0]
  const available = batches
    .filter((b) => b.available_qty > 0 && b.expiry_date >= today)
    .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())

  const filtered = query.trim()
    ? available.filter((b) => b.batch_no.toLowerCase().includes(query.toLowerCase()))
    : available

  function handleSelect(batch: BatchOption) {
    onSelect(batch)
    setOpen(false)
    setQuery(batch.batch_no)
  }

  // Auto-match on Enter if exactly one result or exact match
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const exact = available.find((b) => b.batch_no.toLowerCase() === query.toLowerCase())
      if (exact) { handleSelect(exact); return }
      if (filtered.length === 1) { handleSelect(filtered[0]); return }
    }
    if (e.key === 'Escape') { setOpen(false) }
  }

  const dropdown =
    open && filtered.length > 0 && dropdownPos
      ? createPortal(
          <div
            style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
            className="bg-popover border border-border rounded-lg shadow-xl overflow-hidden max-h-52 overflow-y-auto"
          >
            {/* Column header inside dropdown */}
            <div className="px-3 py-1.5 bg-muted/60 border-b grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Batch No</span>
              <span>Expiry</span>
              <span>Avail</span>
              <span>Price</span>
            </div>
            {filtered.map((batch, idx) => (
              <button
                key={batch.id}
                onMouseDown={() => handleSelect(batch)}
                className="w-full text-left px-3 py-2 hover:bg-primary/5 transition-colors border-b border-border/40 last:border-b-0 grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center"
              >
                <span className="flex items-center gap-1.5">
                  {idx === 0 && (
                    <span className="text-[9px] font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-1 py-0.5 rounded uppercase">
                      FEFO
                    </span>
                  )}
                  <span className="font-mono text-xs font-semibold">{batch.batch_no}</span>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {new Date(batch.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{batch.available_qty}</span>
                <span className="text-xs font-semibold tabular-nums">₹{Number(batch.sale_price).toFixed(2)}</span>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); computePos() }}
        onFocus={() => { computePos(); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder="Batch no..."
        className="h-7 text-xs font-mono px-2 min-w-[90px]"
      />
      {dropdown}
    </div>
  )
}

// ── BillLineItems ─────────────────────────────────────────────────────────────

interface BillLineItemsProps {
  items: BillItem[]
  onUpdate: (id: string, updates: Partial<BillItem>) => void
  onRemove: (id: string) => void
  onAdd: (item: BillItem) => void
  isSyncing?: boolean
}

export function BillLineItems({ items, onUpdate, onRemove, onAdd, isSyncing }: BillLineItemsProps) {
  const comboboxRef  = useRef<HTMLInputElement | null>(null)
  const [taxRates, setTaxRates]           = useState<TaxRate[]>([])
  const [taxPickerItemId, setTaxPickerItemId] = useState<string | null>(null)

  // Draft state — medicine selected, waiting for batch choice
  const [draftMedicine, setDraftMedicine] = useState<MedicineResult | null>(null)

  useEffect(() => {
    fetch('/api/pos/taxes')
      .then((r) => r.json())
      .then((d) => setTaxRates(d.taxRates ?? []))
      .catch(() => {})
  }, [])

  // Step 1: medicine selected from search → enter batch-selection mode
  function handleMedicineSelect(medicine: MedicineResult) {
    setDraftMedicine(medicine)
  }

  // Step 2: batch selected from batch dropdown → commit item to bill
  function handleBatchSelect(batch: BatchOption) {
    if (!draftMedicine) return
    const item: BillItem = {
      id:             crypto.randomUUID(),
      medicine_id:    draftMedicine.id,
      medicine_name:  draftMedicine.name,
      stock_batch_id: batch.id,
      batch_no:       batch.batch_no,
      expiry_date:    batch.expiry_date,
      available_qty:  Number(batch.available_qty),
      qty:            1,
      sale_price:     Number(batch.sale_price),
      discount_type:  'percent',
      discount_value: 0,
      tax:            Number(draftMedicine.tax_percent ?? 0),
      price:          Number(batch.sale_price),
    }
    onAdd(item)
    setDraftMedicine(null)
    // Re-focus medicine search for fast consecutive entry
    setTimeout(() => comboboxRef.current?.focus(), 50)
  }

  function cancelDraft() {
    setDraftMedicine(null)
    setTimeout(() => comboboxRef.current?.focus(), 50)
  }

  return (
    <div>
      <div className="overflow-x-auto [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_td]:border [&_td]:border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-xs tracking-wide text-muted-foreground">
              <th className="text-left px-3 py-2.5 font-semibold min-w-[160px]">
                Name <span className="text-destructive">*</span>
              </th>
              <th className="text-left px-3 py-2.5 font-semibold min-w-[120px]">
                Batch No <span className="text-destructive">*</span>
              </th>
              <th className="text-left px-3 py-2.5 font-semibold min-w-[110px]">
                Expiry Date <span className="text-destructive">*</span>
              </th>
              <th className="text-center px-3 py-2.5 font-semibold whitespace-nowrap min-w-[140px]">
                Qty <span className="text-destructive">*</span>
                <span className="text-muted-foreground/70 font-normal"> | Available Qty</span>
              </th>
              <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap min-w-[110px]">
                Sale Price <span className="text-destructive">*</span>
              </th>
              <th className="text-right px-3 py-2.5 font-semibold min-w-[140px]">Discount</th>
              <th className="text-center px-3 py-2.5 font-semibold min-w-[80px]">Tax</th>
              <th className="text-right px-3 py-2.5 font-semibold min-w-[80px]">
                Price <span className="text-destructive">*</span>
              </th>
              <th className="px-3 py-2.5 min-w-[110px]" />
            </tr>
          </thead>
          <tbody>

            {/* Committed items */}
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-muted/20 transition-colors">

                <td className="px-3 py-2">
                  <div className="font-medium text-sm">{item.medicine_name}</div>
                </td>

                <td className="px-3 py-2">
                  <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                    {item.batch_no}
                  </span>
                </td>

                <td className="px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(item.expiry_date), 'MM/yyyy')}
                  </span>
                </td>

                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1.5">
                    <Input
                      type="number"
                      value={item.qty}
                      onChange={(e) => onUpdate(item.id, { qty: parseInt(e.target.value) || 0 })}
                      className={cn(
                        'h-7 w-16 text-center px-1 font-medium',
                        item.qty > item.available_qty && 'border-destructive text-destructive',
                      )}
                    />
                    <span className="text-xs text-muted-foreground tabular-nums">| {item.available_qty}</span>
                  </div>
                </td>

                <td className="px-3 py-2">
                  <div className="flex justify-end">
                    <Input
                      type="number"
                      value={item.sale_price}
                      min={0}
                      step="0.01"
                      onChange={(e) => onUpdate(item.id, { sale_price: parseFloat(e.target.value) || 0 })}
                      className="h-7 w-24 text-right px-2 font-medium tabular-nums"
                    />
                  </div>
                </td>

                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    <Select
                      value={item.discount_type}
                      onValueChange={(v) => onUpdate(item.id, { discount_type: v as 'percent' | 'flat' })}
                    >
                      <SelectTrigger className="h-7 w-12 text-xs px-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="flat">₹</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={item.discount_value}
                      min={0}
                      max={item.discount_type === 'percent' ? 100 : item.sale_price * item.qty}
                      step="0.01"
                      onChange={(e) => onUpdate(item.id, { discount_value: parseFloat(e.target.value) || 0 })}
                      className="h-7 w-16 text-right px-2"
                    />
                  </div>
                </td>

                <td className="px-3 py-2 text-center">
                  <Input
                    id={`bill-tax-${item.id}`}
                    type="number"
                    value={item.tax}
                    min={0}
                    max={100}
                    step="0.01"
                    onChange={(e) => onUpdate(item.id, { tax: parseFloat(e.target.value) || 0 })}
                    className="h-7 w-16 text-center px-1"
                  />
                </td>

                <td className="px-3 py-2 text-right tabular-nums text-sm font-medium">
                  {item.price.toFixed(2)}
                </td>

                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1.5 items-start">
                    <Button
                      type="button" size="sm" variant="outline"
                      className="h-6 px-3 text-xs rounded-full border-amber-400 bg-amber-400 text-white hover:bg-amber-500 hover:border-amber-500 font-medium"
                      onClick={() => setTaxPickerItemId(item.id)}
                    >
                      Add Taxes
                    </Button>
                    <Button
                      type="button" size="sm" variant="outline"
                      className="h-6 px-3 text-xs rounded-full border-pink-400 bg-pink-400 text-white hover:bg-pink-500 hover:border-pink-500 font-medium"
                      onClick={() => onRemove(item.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}

            {/* ── Draft row ── */}
            {draftMedicine ? (
              /* Phase 2: medicine selected, choose batch */
              <tr className="bg-blue-50/40 dark:bg-blue-950/20">
                {/* Medicine name — fixed, with cancel */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm truncate">{draftMedicine.name}</span>
                    <button
                      type="button"
                      onClick={cancelDraft}
                      title="Cancel — go back to medicine search"
                      className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {draftMedicine.company && (
                    <p className="text-[10px] text-muted-foreground truncate">{draftMedicine.company}</p>
                  )}
                </td>

                {/* Batch — dropdown combobox (auto-focused) */}
                <td className="px-2 py-2">
                  <BatchDropdown
                    batches={draftMedicine.batches}
                    onSelect={handleBatchSelect}
                    autoFocus
                  />
                </td>

                {/* Remaining columns — placeholder until batch selected */}
                <td className="px-3 py-2 text-center text-muted-foreground/40 text-xs">—</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1.5">
                    <Input disabled readOnly value="" className="h-7 w-16 text-center px-1 opacity-40" />
                    <span className="text-xs text-muted-foreground/40 tabular-nums">| 0</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-xs text-muted-foreground/40">—</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 justify-end opacity-40">
                    <Select disabled>
                      <SelectTrigger className="h-7 w-12 text-xs px-1.5">
                        <SelectValue placeholder="%" />
                      </SelectTrigger>
                      <SelectContent><SelectItem value="percent">%</SelectItem></SelectContent>
                    </Select>
                    <Input disabled readOnly value="0.00" className="h-7 w-16 text-right px-2" />
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <Input disabled readOnly value="0" className="h-7 w-16 text-center px-1 opacity-40" />
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-sm text-muted-foreground/40">—</td>
                <td className="px-3 py-2">
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    ↑ Select batch
                  </p>
                </td>
              </tr>
            ) : (
              /* Phase 1: medicine search row */
              <tr className="bg-muted/10">
                <td className="px-1 py-1">
                  <MedicineCombobox
                    externalRef={comboboxRef}
                    onSelect={handleMedicineSelect}
                    disabled={isSyncing}
                  />
                </td>
                <td className="px-3 py-2 text-center text-muted-foreground/40 text-xs">—</td>
                <td className="px-3 py-2 text-center text-muted-foreground/40 text-xs">—</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1.5">
                    <Input disabled readOnly value="" className="h-7 w-16 text-center px-1 opacity-40" />
                    <span className="text-xs text-muted-foreground/40 tabular-nums">| 0</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-xs text-muted-foreground/40">—</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 justify-end opacity-40">
                    <Select disabled>
                      <SelectTrigger className="h-7 w-12 text-xs px-1.5">
                        <SelectValue placeholder="%" />
                      </SelectTrigger>
                      <SelectContent><SelectItem value="percent">%</SelectItem></SelectContent>
                    </Select>
                    <Input disabled readOnly value="0.00" className="h-7 w-16 text-right px-2" />
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <Input disabled readOnly value="0" className="h-7 w-16 text-center px-1 opacity-40" />
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-sm text-muted-foreground/40">0</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1.5 items-start opacity-40">
                    <Button disabled type="button" size="sm" variant="outline"
                      className="h-6 px-3 text-xs rounded-full border-amber-400 bg-amber-400 text-white font-medium">
                      Add Taxes
                    </Button>
                    <Button disabled type="button" size="sm" variant="outline"
                      className="h-6 px-3 text-xs rounded-full border-pink-400 bg-pink-400 text-white font-medium">
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Item — focuses medicine search */}
      <div className="px-3 py-3 border-t border-border/60">
        <Button
          type="button"
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white text-xs px-4 h-8 gap-1.5"
          onClick={() => {
            setDraftMedicine(null)
            setTimeout(() => comboboxRef.current?.focus(), 50)
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Item
        </Button>
      </div>

      {/* ── Tax Picker Dialog ────────────────────────────────────────── */}
      <Dialog
        open={taxPickerItemId !== null}
        onOpenChange={(open) => { if (!open) setTaxPickerItemId(null) }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select Tax Rate</DialogTitle>
          </DialogHeader>
          {taxPickerItemId && (
            <p className="text-xs text-muted-foreground -mt-1 mb-1">
              {items.find((i) => i.id === taxPickerItemId)?.medicine_name}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                if (taxPickerItemId) onUpdate(taxPickerItemId, { tax: 0 })
                setTaxPickerItemId(null)
              }}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 p-3 text-sm font-medium transition-colors',
                items.find((i) => i.id === taxPickerItemId)?.tax === 0
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50',
              )}
            >
              <span className="text-base font-bold">0%</span>
              <span className="text-xs text-muted-foreground">No Tax</span>
            </button>

            {taxRates.map((tr) => (
              <button
                key={tr.id}
                type="button"
                onClick={() => {
                  if (taxPickerItemId) onUpdate(taxPickerItemId, { tax: tr.rate })
                  setTaxPickerItemId(null)
                }}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 p-3 text-sm font-medium transition-colors',
                  items.find((i) => i.id === taxPickerItemId)?.tax === tr.rate
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50',
                )}
              >
                <span className="text-base font-bold">{tr.rate}%</span>
                <span className="text-xs text-muted-foreground">{tr.name}</span>
              </button>
            ))}

            {taxRates.length === 0 && (
              <p className="col-span-2 text-xs text-muted-foreground text-center py-2">
                No tax rates configured. Add them in Settings → Tax Rates.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
