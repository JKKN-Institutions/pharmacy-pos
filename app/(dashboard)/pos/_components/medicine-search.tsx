'use client'

import { useState, useCallback } from 'react'
import { db } from '@/lib/offline/db'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import type { BillItem } from './pos-client'
import { toast } from 'sonner'

interface MedicineSearchProps {
  onAddItem: (item: BillItem) => void
}

export function MedicineSearch({ onAddItem }: MedicineSearchProps) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [open, setOpen] = useState(false)

  const handleSearch = useCallback(async (query: string) => {
    setSearch(query)
    if (query.length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    const medicines = await db.medicines
      .filter(m =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        (m.company?.toLowerCase().includes(query.toLowerCase()) ?? false)
      )
      .limit(10)
      .toArray()

    setResults(medicines)
    setOpen(medicines.length > 0)
  }, [])

  function handleSelect(medicine: any) {
    const availableBatches = (medicine.batches ?? [])
      .filter((b: any) => b.available_qty > 0)
      .sort((a: any, b: any) =>
        new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
      )

    if (availableBatches.length === 0) {
      toast.error(`${medicine.name} is out of stock`)
      return
    }

    const fefo = availableBatches[0]
    const item: BillItem = {
      id: crypto.randomUUID(),
      medicine_id: medicine.id,
      medicine_name: medicine.name,
      stock_batch_id: fefo.id,
      batch_no: fefo.batch_no,
      expiry_date: fefo.expiry_date,
      available_qty: fefo.available_qty,
      qty: 1,
      sale_price: fefo.sale_price,
      discount_type: 'percent',
      discount_value: 0,
      tax: 0,
      price: fefo.sale_price,
    }

    onAddItem(item)
    setSearch('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search medicine name to add to bill..."
          className="pl-9 h-11 text-base"
          autoFocus
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {results.map(medicine => {
            const availableCount = (medicine.batches ?? []).filter((b: any) => b.available_qty > 0).length
            return (
              <button
                key={medicine.id}
                onClick={() => handleSelect(medicine)}
                className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border last:border-b-0"
              >
                <div className="font-medium text-sm">{medicine.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {medicine.company ?? 'Unknown company'} · {availableCount} batch(es) in stock
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
