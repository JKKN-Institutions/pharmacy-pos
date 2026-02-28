'use client'

import { useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import type { BillItem } from './pos-client'
import { db } from '@/lib/offline/db'
import { toast } from 'sonner'

// ── Inline medicine combobox — renders dropdown via portal to escape overflow-x-auto clipping ──
function MedicineCombobox({
  onSelect,
  disabled,
  externalRef,
}: {
  onSelect: (medicine: any, batch: any) => void
  disabled?: boolean
  externalRef?: React.RefObject<HTMLInputElement | null>
}) {
  const internalRef = useRef<HTMLInputElement | null>(null)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Merge the external "focus" ref and our internal positioning ref into one callback ref
  function mergeRef(el: HTMLInputElement | null) {
    internalRef.current = el
    if (externalRef) externalRef.current = el
  }

  function computePos() {
    const el = internalRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setDropdownPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(288, rect.width),
    })
  }

  const handleSearch = useCallback((query: string) => {
    setSearch(query)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        let medicines: any[] = []
        if (navigator.onLine) {
          const res = await fetch(`/api/pos/search?q=${encodeURIComponent(query)}`)
          if (res.ok) {
            medicines = (await res.json()).medicines ?? []
          } else {
            const q = query.toLowerCase()
            medicines = await db.medicines.filter(m => m.name.toLowerCase().includes(q)).limit(10).toArray()
          }
        } else {
          const q = query.toLowerCase()
          medicines = await db.medicines.filter(m => m.name.toLowerCase().includes(q)).limit(10).toArray()
        }
        computePos()
        setResults(medicines)
        setOpen(medicines.length > 0)
      } catch {
        setResults([])
        setOpen(false)
      }
    }, 300)
  }, [])

  function handleSelect(medicine: any) {
    const batches = (medicine.batches ?? [])
      .filter((b: any) => b.available_qty > 0)
      .sort((a: any, b: any) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())
    if (batches.length === 0) {
      toast.error(`${medicine.name} is out of stock`)
      return
    }
    onSelect(medicine, batches[0])
    setSearch('')
    setResults([])
    setOpen(false)
  }

  const dropdown =
    open && results.length > 0 && dropdownPos
      ? createPortal(
          <div
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 9999,
            }}
            className="bg-popover border border-border rounded-lg shadow-xl overflow-hidden"
          >
            <div className="px-3 py-1.5 border-b bg-muted/40">
              <p className="text-xs text-muted-foreground font-medium">
                {results.length} result{results.length !== 1 ? 's' : ''} — click to add
              </p>
            </div>
            <div className="max-h-52 overflow-y-auto">
              {results.map(m => (
                <button
                  key={m.id}
                  onMouseDown={() => handleSelect(m)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b border-border/60 last:border-b-0"
                >
                  <span className="font-medium">{m.name}</span>
                  {m.company && (
                    <span className="text-xs text-muted-foreground ml-2">{m.company}</span>
                  )}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div className="relative">
      <Input
        ref={mergeRef}
        value={search}
        onChange={e => handleSearch(e.target.value)}
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

interface BillLineItemsProps {
  items: BillItem[]
  onUpdate: (id: string, updates: Partial<BillItem>) => void
  onRemove: (id: string) => void
  onAdd: (item: BillItem) => void
  isSyncing?: boolean
}

export function BillLineItems({ items, onUpdate, onRemove, onAdd, isSyncing }: BillLineItemsProps) {
  const comboboxRef = useRef<HTMLInputElement | null>(null)

  function handleMedicineSelect(medicine: any, batch: any) {
    const item: BillItem = {
      id: crypto.randomUUID(),
      medicine_id: medicine.id,
      medicine_name: medicine.name,
      stock_batch_id: batch.id,
      batch_no: batch.batch_no,
      expiry_date: batch.expiry_date,
      available_qty: batch.available_qty,
      qty: 1,
      sale_price: batch.sale_price,
      discount_type: 'percent',
      discount_value: 0,
      tax: medicine.tax_percent ?? 0,
      price: batch.sale_price,
    }
    onAdd(item)
    // Re-focus combobox for fast consecutive entry
    setTimeout(() => comboboxRef.current?.focus(), 50)
  }

  return (
    <div>
      {/* Grid-border table — same pattern as purchase form */}
      <div className="overflow-x-auto [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_td]:border [&_td]:border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-xs tracking-wide text-muted-foreground">
              <th className="text-left px-3 py-2.5 font-semibold min-w-[160px]">
                Name <span className="text-destructive">*</span>
              </th>
              <th className="text-left px-3 py-2.5 font-semibold min-w-[100px]">
                Batch No <span className="text-destructive">*</span>
              </th>
              <th className="text-left px-3 py-2.5 font-semibold min-w-[110px]">
                ExpiryDate <span className="text-destructive">*</span>
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
              {/* Actions col — no header */}
              <th className="px-3 py-2.5 min-w-[110px]" />
            </tr>
          </thead>
          <tbody>
            {/* Existing committed items */}
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-muted/20 transition-colors">

                {/* Name */}
                <td className="px-3 py-2">
                  <div className="font-medium text-sm max-w-[160px] truncate" title={item.medicine_name}>
                    {item.medicine_name}
                  </div>
                </td>

                {/* Batch No */}
                <td className="px-3 py-2">
                  <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                    {item.batch_no}
                  </span>
                </td>

                {/* Expiry Date */}
                <td className="px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(item.expiry_date), 'MM/yyyy')}
                  </span>
                </td>

                {/* Qty | Available Qty */}
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1.5">
                    <Input
                      type="number"
                      value={item.qty}
                      min={1}
                      max={item.available_qty}
                      onChange={(e) =>
                        onUpdate(item.id, {
                          qty: Math.min(parseInt(e.target.value) || 1, item.available_qty),
                        })
                      }
                      className="h-7 w-16 text-center px-1 font-medium"
                    />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      | {item.available_qty}
                    </span>
                  </div>
                </td>

                {/* Sale Price — readonly */}
                <td className="px-3 py-2 text-right text-sm tabular-nums text-muted-foreground">
                  {item.sale_price.toFixed(2)}
                </td>

                {/* Discount — type Select + value Input inline */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    <Select
                      value={item.discount_type}
                      onValueChange={(v) =>
                        onUpdate(item.id, { discount_type: v as 'percent' | 'flat' })
                      }
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
                      onChange={(e) =>
                        onUpdate(item.id, { discount_value: parseFloat(e.target.value) || 0 })
                      }
                      className="h-7 w-16 text-right px-2"
                    />
                  </div>
                </td>

                {/* Tax — plain input with id for focus from Add Taxes button */}
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

                {/* Price — plain decimal */}
                <td className="px-3 py-2 text-right tabular-nums text-sm font-medium">
                  {item.price.toFixed(2)}
                </td>

                {/* Actions — Add Taxes pill + Delete pill */}
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1.5 items-start">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 px-3 text-xs rounded-full border-amber-400 bg-amber-400 text-white hover:bg-amber-500 hover:border-amber-500 font-medium"
                      onClick={() => document.getElementById(`bill-tax-${item.id}`)?.focus()}
                    >
                      Add Taxes
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 px-3 text-xs rounded-full border-pink-400 bg-pink-400 text-white hover:bg-pink-500 hover:border-pink-500 font-medium"
                      onClick={() => onRemove(item.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </td>

              </tr>
            ))}

            {/* Draft row — always visible, Name cell has the inline medicine combobox */}
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
                  <Input
                    disabled
                    readOnly
                    value=""
                    className="h-7 w-16 text-center px-1 opacity-40"
                  />
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
                    <SelectContent>
                      <SelectItem value="percent">%</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input disabled readOnly value="0.00" className="h-7 w-16 text-right px-2" />
                </div>
              </td>
              <td className="px-3 py-2 text-center">
                <Input disabled readOnly value="0" className="h-7 w-16 text-center px-1 opacity-40" />
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-sm text-muted-foreground/40">
                0
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-col gap-1.5 items-start opacity-40">
                  <Button
                    disabled
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 px-3 text-xs rounded-full border-amber-400 bg-amber-400 text-white font-medium"
                  >
                    Add Taxes
                  </Button>
                  <Button
                    disabled
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 px-3 text-xs rounded-full border-pink-400 bg-pink-400 text-white font-medium"
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Add Item — focuses the inline combobox in the draft row */}
      <div className="px-3 py-3 border-t border-border/60">
        <Button
          type="button"
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white text-xs px-4 h-8 gap-1.5"
          onClick={() => comboboxRef.current?.focus()}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Item
        </Button>
      </div>
    </div>
  )
}
