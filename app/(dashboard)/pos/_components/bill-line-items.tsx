'use client'

import { Trash2, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'
import { formatINR } from '@/lib/utils/currency'
import type { BillItem } from './pos-client'

interface BillLineItemsProps {
  items: BillItem[]
  onUpdate: (id: string, updates: Partial<BillItem>) => void
  onRemove: (id: string) => void
}

export function BillLineItems({ items, onUpdate, onRemove }: BillLineItemsProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <p className="text-sm">Search for a medicine above to start billing</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="text-left p-3">Medicine</th>
            <th className="text-center p-3 w-28">Qty</th>
            <th className="text-right p-3">Price</th>
            <th className="text-right p-3">Discount%</th>
            <th className="text-right p-3">Total</th>
            <th className="p-3 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-b last:border-b-0 hover:bg-muted/20">
              <td className="p-3">
                <div className="font-medium">{item.medicine_name}</div>
                <div className="text-xs text-muted-foreground">
                  Batch: {item.batch_no} · Exp: {format(new Date(item.expiry_date), 'MM/yyyy')}
                </div>
              </td>
              <td className="p-3">
                <div className="flex items-center justify-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onUpdate(item.id, { qty: Math.max(1, item.qty - 1) })}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="number"
                    value={item.qty}
                    min={1}
                    max={item.available_qty}
                    onChange={e => onUpdate(item.id, { qty: Math.min(parseInt(e.target.value) || 1, item.available_qty) })}
                    className="h-7 w-14 text-center px-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onUpdate(item.id, { qty: Math.min(item.qty + 1, item.available_qty) })}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </td>
              <td className="p-3 text-right">{formatINR(item.sale_price)}</td>
              <td className="p-3 text-right">
                <Input
                  type="number"
                  value={item.discount_value}
                  min={0}
                  max={100}
                  onChange={e => onUpdate(item.id, { discount_value: parseFloat(e.target.value) || 0 })}
                  className="h-7 w-16 text-right px-1 ml-auto"
                />
              </td>
              <td className="p-3 text-right font-semibold">{formatINR(item.price)}</td>
              <td className="p-3">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onRemove(item.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
