'use client'

import { Trash2, Minus, Plus, PackageSearch } from 'lucide-react'
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
      <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <PackageSearch className="w-6 h-6 text-muted-foreground opacity-60" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">No items added yet</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Search for a medicine above to start billing
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <th className="text-left px-4 py-2.5">#</th>
            <th className="text-left px-4 py-2.5">Medicine</th>
            <th className="text-center px-4 py-2.5 w-32">Qty</th>
            <th className="text-right px-4 py-2.5">Price</th>
            <th className="text-right px-4 py-2.5 w-24">Disc %</th>
            <th className="text-right px-4 py-2.5">Tax</th>
            <th className="text-right px-4 py-2.5 font-semibold text-foreground/80">Total</th>
            <th className="px-4 py-2.5 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {items.map((item, idx) => (
            <tr key={item.id} className="hover:bg-muted/20 transition-colors group">
              <td className="px-4 py-3 text-muted-foreground text-xs">{idx + 1}</td>
              <td className="px-4 py-3">
                <div className="font-medium text-sm">{item.medicine_name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Batch: <span className="font-mono">{item.batch_no}</span>
                  {' · '}Exp: {format(new Date(item.expiry_date), 'MM/yyyy')}
                  {' · '}Stock: {item.available_qty}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => onUpdate(item.id, { qty: Math.max(1, item.qty - 1) })}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="number"
                    value={item.qty}
                    min={1}
                    max={item.available_qty}
                    onChange={e =>
                      onUpdate(item.id, {
                        qty: Math.min(parseInt(e.target.value) || 1, item.available_qty),
                      })
                    }
                    className="h-7 w-14 text-center px-1 font-medium"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() =>
                      onUpdate(item.id, { qty: Math.min(item.qty + 1, item.available_qty) })
                    }
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {formatINR(item.sale_price)}
              </td>
              <td className="px-4 py-3 text-right">
                <Input
                  type="number"
                  value={item.discount_value}
                  min={0}
                  max={100}
                  onChange={e =>
                    onUpdate(item.id, { discount_value: parseFloat(e.target.value) || 0 })
                  }
                  className="h-7 w-16 text-right px-2 ml-auto"
                />
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                {item.tax > 0 ? `${item.tax}%` : '—'}
              </td>
              <td className="px-4 py-3 text-right font-semibold">{formatINR(item.price)}</td>
              <td className="px-4 py-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onRemove(item.id)}
                >
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
