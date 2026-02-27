'use client'

import { useEffect, useState } from 'react'
import { syncMedicines, flushOfflineBills } from '@/lib/offline/sync'
import { db } from '@/lib/offline/db'
import { MedicineSearch } from './medicine-search'
import { BillLineItems } from './bill-line-items'
import { BillTotals } from './bill-totals'
import { CustomerInfo } from './customer-info'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
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
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [items, setItems] = useState<BillItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [doctor, setDoctor] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'credit'>('cash')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    setIsSyncing(true)
    syncMedicines().finally(() => setIsSyncing(false))

    const handleOnline = () => {
      setIsOnline(true)
      flushOfflineBills()
    }
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const lineItemTotals = items.map(item =>
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
    setItems(prev => {
      const existing = prev.find(i => i.stock_batch_id === item.stock_batch_id)
      if (existing) {
        return prev.map(i =>
          i.stock_batch_id === item.stock_batch_id
            ? { ...i, qty: Math.min(i.qty + 1, i.available_qty) }
            : i
        )
      }
      return [...prev, item]
    })
  }

  function updateItem(id: string, updates: Partial<BillItem>) {
    setItems(prev => prev.map(i => {
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
    }))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function clearBill() {
    setItems([])
    setCustomerName('')
    setCustomerPhone('')
    setDoctor('')
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
      customer_name: customerName || null,
      customer_email: null,
      customer_phone: customerPhone || null,
      doctor: doctor || null,
      payment_method: paymentMethod,
      items: items.map(({ id, available_qty, ...rest }) => rest),
      subtotal: totals.subtotal,
      discount_total: totals.discount_total,
      tax_total: totals.tax_total,
      total: totals.total,
      paid: totals.total,
      due: 0,
      note: note || null,
      bill_date: new Date().toISOString().split('T')[0],
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

  return (
    <div className="space-y-4">

      {/* Status bar */}
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
          onClick={() => {
            setIsSyncing(true)
            syncMedicines()
              .then(() => toast.success('Medicine catalog synced'))
              .finally(() => setIsSyncing(false))
          }}
          className="h-8 gap-1.5 text-muted-foreground text-xs"
          title="Sync medicine catalog"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          Sync catalog
        </Button>
      </div>

      {/* Medicine Search */}
      <MedicineSearch onAddItem={addItem} isSyncing={isSyncing} />

      {/* Bill Items Table */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <BillLineItems items={items} onUpdate={updateItem} onRemove={removeItem} />
        <BillTotals totals={totals} />
      </div>

      {/* Customer Info */}
      <CustomerInfo
        name={customerName} onNameChange={setCustomerName}
        phone={customerPhone} onPhoneChange={setCustomerPhone}
        doctor={doctor} onDoctorChange={setDoctor}
        paymentMethod={paymentMethod} onPaymentMethodChange={setPaymentMethod}
        note={note} onNoteChange={setNote}
      />

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-1">
        <Button
          variant="outline"
          onClick={() => { clearBill(); onCancel?.() }}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || items.length === 0}
          size="lg"
          className="px-10 gap-2"
        >
          {saving ? 'Saving...' : `Save Bill · ₹${totals.total.toFixed(2)}`}
        </Button>
      </div>
    </div>
  )
}

/** @deprecated use PosForm instead */
export const PosClient = PosForm
