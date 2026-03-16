'use client'

import { useState } from 'react'
import { Eye, Loader2, Receipt } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { getBillItemsAction } from './actions'
import { formatINR } from '@/lib/utils/currency'
import { DownloadBillButton } from '@/components/pos/download-bill-button'
import { PrintBillButton } from '@/components/pos/print-bill-button'
import type { PosBill } from '@/lib/types/database'

type BillItem = {
  id: string
  medicine_name: string | null
  batch_no: string
  qty: number
  sale_price: number
  price: number
}

const statusStyles: Record<string, string> = {
  saved:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  synced:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  sync_error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled:  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const methodStyles: Record<string, string> = {
  cash:   'text-green-700 dark:text-green-400',
  upi:    'text-blue-700 dark:text-blue-400',
  card:   'text-purple-700 dark:text-purple-400',
  credit: 'text-amber-700 dark:text-amber-400',
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

  const itemCount = items?.length ?? 0
  const totalQty = items?.reduce((sum, item) => sum + item.qty, 0) ?? 0

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
        <DialogContent className="sm:max-w-5xl w-[95vw] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          {/* Fixed Header */}
          <DialogHeader className="px-6 pt-6 pb-4 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="font-mono text-lg">
                    {bill.bill_no}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(bill.bill_date), 'dd MMM yyyy, hh:mm a')}
                  </p>
                </div>
              </div>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusStyles[bill.status] ?? ''}`}>
                {bill.status}
              </span>
            </div>

            {/* Meta cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Customer</p>
                <p className="text-sm font-semibold truncate">{bill.customer_name ?? 'Walk-in'}</p>
                {bill.customer_phone && (
                  <p className="text-xs text-muted-foreground">{bill.customer_phone}</p>
                )}
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Payment</p>
                <p className={`text-sm font-semibold capitalize ${methodStyles[bill.payment_method] ?? ''}`}>
                  {bill.payment_method}
                </p>
              </div>
              {bill.doctor ? (
                <div className="rounded-lg border bg-muted/30 px-3 py-2">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Doctor</p>
                  <p className="text-sm font-semibold truncate">{bill.doctor}</p>
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/30 px-3 py-2">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Items</p>
                  <p className="text-sm font-semibold">{itemCount} items, {totalQty} qty</p>
                </div>
              )}
            </div>
          </DialogHeader>

          <Separator />

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
            {/* Cancellation info */}
            {bill.status === 'cancelled' && bill.cancel_reason && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/40 p-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
                  Cancelled
                  {bill.cancelled_at && (
                    <span className="font-normal normal-case tracking-normal ml-1.5 text-red-500/70 dark:text-red-400/60">
                      on {format(new Date(bill.cancelled_at), 'dd MMM yyyy, hh:mm a')}
                    </span>
                  )}
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">{bill.cancel_reason}</p>
              </div>
            )}

            {bill.note && (
              <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Note</p>
                <p className="text-sm">{bill.note}</p>
              </div>
            )}

            {/* Line items table */}
            {loading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading items…</span>
              </div>
            ) : items && items.length > 0 ? (
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="bg-muted/60 border-b">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-10">#</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Medicine</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-20">Batch</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-16">Qty</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">Price</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={item.id} className={`border-b last:border-0 ${i % 2 === 1 ? 'bg-muted/20' : ''}`}>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium whitespace-nowrap">{item.medicine_name ?? '—'}</td>
                        <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{item.batch_no}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{item.qty}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{formatINR(item.sale_price)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatINR(item.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No items found</p>
            )}
          </div>

          {/* Fixed Footer - Totals + Actions */}
          <div className="shrink-0 border-t bg-muted/30 px-6 py-4 space-y-3">
            <div className="space-y-1.5 text-sm">
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
              <Separator />
              <div className="flex justify-between font-bold text-lg pt-1">
                <span>Total</span>
                <span className="tabular-nums text-primary">{formatINR(bill.total)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <PrintBillButton bill={bill} showLabel variant="outline" />
              <DownloadBillButton bill={bill} showLabel variant="outline" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
