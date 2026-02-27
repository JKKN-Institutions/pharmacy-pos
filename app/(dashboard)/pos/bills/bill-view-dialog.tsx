'use client'

import { useState } from 'react'
import { Eye, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getBillItemsAction } from './actions'
import { formatINR } from '@/lib/utils/currency'
import type { PosBill } from '@/lib/types/database'

type BillItem = {
  id: string
  batch_no: string
  qty: number
  sale_price: number
  price: number
  medicines: { name: string } | null
}

const statusStyles: Record<string, string> = {
  saved:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  synced:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  sync_error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const methodStyles: Record<string, string> = {
  cash:   'bg-green-50 text-green-700 dark:bg-green-900/20',
  upi:    'bg-blue-50 text-blue-700 dark:bg-blue-900/20',
  card:   'bg-purple-50 text-purple-700 dark:bg-purple-900/20',
  credit: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20',
}

interface BillViewDialogProps {
  bill: PosBill
}

export function BillViewDialog({ bill }: BillViewDialogProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<BillItem[] | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleOpen() {
    setOpen(true)
    if (items !== null) return   // already fetched
    setLoading(true)
    const result = await getBillItemsAction(bill.id)
    setItems((result.data ?? []) as unknown as BillItem[])
    setLoading(false)
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="View bill"
        onClick={handleOpen}
      >
        <Eye className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">
              {bill.bill_no}
            </DialogTitle>
          </DialogHeader>

          {/* Bill meta */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm border-b pb-4">
            <div>
              <span className="text-muted-foreground">Date</span>
              <p className="font-medium">{format(new Date(bill.bill_date), 'dd MMM yyyy')}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Customer</span>
              <p className="font-medium">{bill.customer_name ?? 'Walk-in'}</p>
              {bill.customer_phone && (
                <p className="text-xs text-muted-foreground">{bill.customer_phone}</p>
              )}
            </div>
            {bill.doctor && (
              <div>
                <span className="text-muted-foreground">Doctor</span>
                <p className="font-medium">{bill.doctor}</p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Payment</span>
              <p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize mt-0.5 ${methodStyles[bill.payment_method] ?? ''}`}>
                  {bill.payment_method}
                </span>
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize mt-0.5 ${statusStyles[bill.status] ?? ''}`}>
                  {bill.status}
                </span>
              </p>
            </div>
            {bill.note && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Note</span>
                <p className="font-medium">{bill.note}</p>
              </div>
            )}
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items</p>

            {loading ? (
              <div className="flex items-center justify-center h-24 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading items…</span>
              </div>
            ) : items && items.length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/60 border-b text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="text-left px-3 py-2 font-semibold">Medicine</th>
                      <th className="text-left px-3 py-2 font-semibold">Batch</th>
                      <th className="text-right px-3 py-2 font-semibold">Qty</th>
                      <th className="text-right px-3 py-2 font-semibold">Price</th>
                      <th className="text-right px-3 py-2 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={item.id} className={`border-b last:border-0 ${i % 2 === 1 ? 'bg-muted/20' : ''}`}>
                        <td className="px-3 py-2 font-medium">{item.medicines?.name ?? '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{item.batch_no}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{item.qty}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatINR(item.sale_price)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatINR(item.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No items found</p>
            )}
          </div>

          {/* Totals */}
          <div className="space-y-1 text-sm border-t pt-3">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatINR(bill.subtotal)}</span>
            </div>
            {bill.discount_total > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span className="tabular-nums text-red-500">− {formatINR(bill.discount_total)}</span>
              </div>
            )}
            {bill.tax_total > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span>
                <span className="tabular-nums">+ {formatINR(bill.tax_total)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t">
              <span>Total</span>
              <span className="tabular-nums">{formatINR(bill.total)}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
