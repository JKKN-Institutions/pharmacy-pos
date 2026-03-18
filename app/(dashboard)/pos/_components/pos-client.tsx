'use client'

import { useEffect, useState } from 'react'
import { syncMedicines, flushOfflineBills, isSyncInProgress } from '@/lib/offline/sync'
import { db } from '@/lib/offline/db'
import { BillLineItems } from './bill-line-items'
import { BillTotals } from './bill-totals'
import { CustomerInfo } from './customer-info'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Wifi, WifiOff, RefreshCw, Save, Eye, ArrowLeft, Pencil, User, Phone, Mail, Stethoscope, Calendar, CreditCard, StickyNote } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { formatINR } from '@/lib/utils/currency'
import { format } from 'date-fns'
import { calculateLineItem, calculateBillTotals } from '@/lib/utils/billing'
import type { DiscountType } from '@/lib/types/database'

export interface BillItem {
  id: string
  medicine_id: string
  medicine_name: string
  stock_batch_id: string
  batch_no: string
  expiry_date: string
  available_qty: number
  qty: number
  sale_price: number
  discount_type: DiscountType
  discount_value: number
  tax: number
  price: number
}

interface PosFormProps {
  userId?: string
  branchId?: string
  onSaved?: () => void
  onCancel?: () => void
}

export function PosForm({ userId, branchId, onSaved, onCancel }: PosFormProps) {
  const [isOnline, setIsOnline]         = useState(true)
  const [isSyncing, setIsSyncing]       = useState(false)
  const [items, setItems]               = useState<BillItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [doctor, setDoctor]             = useState('')
  const [billDate, setBillDate]         = useState(() => new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'credit'>('cash')
  const [note, setNote]                 = useState('')
  const [saving, setSaving]             = useState(false)
  const [showPreview, setShowPreview]   = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    setIsSyncing(true)
    syncMedicines().finally(() => setIsSyncing(false))

    const handleOnline  = () => { setIsOnline(true); flushOfflineBills() }
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const lineItemTotals = items.map((item) =>
    calculateLineItem({
      qty: item.qty,
      unit_price: item.sale_price,
      discount_type: item.discount_type,
      discount_value: item.discount_value,
      tax: item.tax,
    })
  )
  const totals = calculateBillTotals(lineItemTotals)

  function addItem(item: BillItem) {
    setItems((prev) => {
      const existing = prev.find((i) => i.stock_batch_id === item.stock_batch_id)
      if (existing) {
        return prev.map((i) =>
          i.stock_batch_id === item.stock_batch_id
            ? { ...i, qty: Math.min(i.qty + 1, i.available_qty) }
            : i
        )
      }
      return [...prev, item]
    })
  }

  function updateItem(id: string, updates: Partial<BillItem>) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i
        const updated = { ...i, ...updates }
        const line = calculateLineItem({
          qty: updated.qty,
          unit_price: updated.sale_price,
          discount_type: updated.discount_type,
          discount_value: updated.discount_value,
          tax: updated.tax,
        })
        return { ...updated, price: line.price }
      })
    )
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function clearBill() {
    setItems([])
    setCustomerName('')
    setCustomerEmail('')
    setCustomerPhone('')
    setDoctor('')
    setBillDate(new Date().toISOString().split('T')[0])
    setNote('')
    setPaymentMethod('cash')
  }

  async function handleSave() {
    if (items.length === 0) {
      toast.error('Add at least one item to generate a bill')
      return
    }

    setSaving(true)
    const billData = {
      customer_name:  customerName  || null,
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      doctor:         doctor        || null,
      payment_method: paymentMethod,
      items: items.map(({ id, available_qty, ...rest }) => rest),
      subtotal:       totals.subtotal,
      discount_total: totals.discount_total,
      tax_total:      totals.tax_total,
      total:          totals.total,
      paid:           totals.total,
      due:            0,
      note:           note || null,
      bill_date:      billDate,
    }

    if (isOnline) {
      try {
        const res = await fetch('/api/pos/bills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(billData),
        })
        const responseData = await res.json()
        if (res.ok) {
          toast.success(`Bill ${responseData.bill_no} saved!`)
          clearBill()
          onSaved?.()
        } else {
          toast.error(responseData.error ?? 'Failed to save bill')
        }
      } catch {
        await queueOffline(billData)
      }
    } else {
      await queueOffline(billData)
    }
    setSaving(false)
  }

  async function queueOffline(billData: any) {
    const id = crypto.randomUUID()
    await db.offline_bills.add({
      id,
      bill_data: billData,
      created_at: new Date().toISOString(),
      sync_status: 'pending',
    })
    toast.warning('Saved offline — will sync when internet returns')
    clearBill()
    onSaved?.()
  }

  /* ── Preview View ──────────────────────────────────────── */
  if (showPreview) {
    const paymentMethodLabels: Record<string, string> = {
      cash: 'Cash', upi: 'UPI', card: 'Card', credit: 'Credit',
    }
    const methodColors: Record<string, string> = {
      cash: 'text-green-700 dark:text-green-400',
      upi: 'text-blue-700 dark:text-blue-400',
      card: 'text-purple-700 dark:text-purple-400',
      credit: 'text-amber-700 dark:text-amber-400',
    }

    return (
      <div className="space-y-5">

        {/* Preview header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Bill Preview</h2>
              <p className="text-sm text-muted-foreground">
                Review the bill before saving
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(false)}
            className="h-8 gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit Bill
          </Button>
        </div>

        {/* Customer & payment meta cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {customerName && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3" /> Customer
              </p>
              <p className="text-sm font-semibold truncate">{customerName}</p>
            </div>
          )}
          {customerPhone && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Phone className="w-3 h-3" /> Phone
              </p>
              <p className="text-sm font-semibold">{customerPhone}</p>
            </div>
          )}
          {doctor && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Stethoscope className="w-3 h-3" /> Doctor
              </p>
              <p className="text-sm font-semibold truncate">{doctor}</p>
            </div>
          )}
          <div className="rounded-lg border bg-muted/30 px-3 py-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Date
            </p>
            <p className="text-sm font-semibold">
              {format(new Date(billDate + 'T00:00:00'), 'dd MMM yyyy')}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 px-3 py-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <CreditCard className="w-3 h-3" /> Payment
            </p>
            <p className={`text-sm font-semibold ${methodColors[paymentMethod] ?? ''}`}>
              {paymentMethodLabels[paymentMethod] ?? paymentMethod}
            </p>
          </div>
        </div>

        {/* Line items table */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-muted/60 border-b">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-10">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Medicine</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">Batch</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-20">Expiry</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-14">Qty</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">Price</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-20">Disc</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-16">Tax%</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const line = lineItemTotals[i]
                  return (
                    <tr key={item.id} className={`border-b last:border-0 ${i % 2 === 1 ? 'bg-muted/20' : ''}`}>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap">{item.medicine_name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{item.batch_no}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {format(new Date(item.expiry_date + 'T00:00:00'), 'MMM yyyy')}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{item.qty}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{formatINR(item.sale_price)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {item.discount_value > 0
                          ? item.discount_type === 'percent'
                            ? `${item.discount_value}%`
                            : formatINR(item.discount_value)
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{item.tax}%</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatINR(line.price)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t bg-muted/20 px-5 py-4">
            <div className="flex justify-end">
              <div className="w-72 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatINR(totals.subtotal)}</span>
                </div>
                {totals.discount_total > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount</span>
                    <span className="tabular-nums text-red-500">− {formatINR(totals.discount_total)}</span>
                  </div>
                )}
                {totals.tax_total > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax</span>
                    <span className="tabular-nums">+ {formatINR(totals.tax_total)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg pt-1">
                  <span>Total</span>
                  <span className="tabular-nums text-primary">{formatINR(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Note */}
        {note && (
          <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <StickyNote className="w-3 h-3" /> Note
            </p>
            <p className="text-sm">{note}</p>
          </div>
        )}

        {/* Preview actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(false)}
            disabled={saving}
            className="w-full sm:w-auto gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Edit Bill
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            size="lg"
            className="w-full sm:w-44 gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Confirm & Save'}
          </Button>
        </div>
      </div>
    )
  }

  /* ── Form View (default) ──────────────────────────────── */
  return (
    <div className="space-y-4">

      {/* ── Status + Sync bar ──────────────────────────────── */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Badge variant="outline" className="gap-1.5 text-green-700 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
              <Wifi className="w-3 h-3" /> Online
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 text-amber-700 border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
              <WifiOff className="w-3 h-3" /> Offline Mode
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={isSyncing}
          onClick={() => {
            if (isSyncInProgress()) return
            setIsSyncing(true)
            syncMedicines()
              .then((ok) => ok && toast.success('Medicine catalog synced'))
              .finally(() => setIsSyncing(false))
          }}
          className="h-8 gap-1.5 text-muted-foreground text-xs"
          title="Sync medicine catalog"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          Sync catalog
        </Button>
      </div>

      {/* ── Bill items + Totals (bordered card) ───────────── */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <BillLineItems
          items={items}
          onUpdate={updateItem}
          onRemove={removeItem}
          onAdd={addItem}
          isSyncing={isSyncing}
        />
        <BillTotals totals={totals} />
      </div>

      {/* ── Customer / payment info ────────────────────────── */}
      <CustomerInfo
        name={customerName}           onNameChange={setCustomerName}
        email={customerEmail}         onEmailChange={setCustomerEmail}
        phone={customerPhone}         onPhoneChange={setCustomerPhone}
        doctor={doctor}               onDoctorChange={setDoctor}
        billDate={billDate}           onBillDateChange={setBillDate}
        paymentMethod={paymentMethod} onPaymentMethodChange={setPaymentMethod}
        note={note}                   onNoteChange={setNote}
      />

      {/* ── Review / Cancel actions ──────────────────────── */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 pt-2">
        <Button
          variant="outline"
          onClick={() => { clearBill(); onCancel?.() }}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (items.length === 0) {
              toast.error('Add at least one item to generate a bill')
              return
            }
            setShowPreview(true)
          }}
          disabled={items.length === 0}
          size="lg"
          className="w-full sm:w-44 gap-2"
        >
          <Eye className="w-4 h-4" />
          Review Bill
        </Button>
      </div>

    </div>
  )
}

/** @deprecated use PosForm instead */
export const PosClient = PosForm
