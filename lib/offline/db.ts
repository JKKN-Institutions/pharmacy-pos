import Dexie, { type EntityTable } from 'dexie'

interface OfflineMedicine {
  id: string
  name: string
  company: string | null
  tax_percent?: number
  batches: Array<{
    id: string
    batch_no: string
    expiry_date: string
    sale_price: number
    available_qty: number
  }>
  last_synced_at: string
}

interface OfflineBill {
  id: string
  bill_data: {
    customer_name?: string | null
    customer_email?: string | null
    customer_phone?: string | null
    doctor?: string | null
    payment_method: string
    items: Array<{
      medicine_id: string
      medicine_name: string | null
      stock_batch_id: string
      batch_no: string
      expiry_date: string
      qty: number
      sale_price: number
      discount_type: 'percent' | 'flat'
      discount_value: number
      tax: number
      price: number
    }>
    subtotal: number
    discount_total: number
    tax_total: number
    total: number
    paid: number
    due: number
    note?: string | null
    bill_date: string
  }
  created_at: string
  sync_status: 'pending' | 'synced' | 'error'
  error_message?: string
  synced_bill_no?: string
}

class PharmacyDB extends Dexie {
  medicines!: EntityTable<OfflineMedicine, 'id'>
  offline_bills!: EntityTable<OfflineBill, 'id'>

  constructor() {
    super('PharmacyPOS')
    this.version(1).stores({
      medicines: 'id, name',
      offline_bills: 'id, sync_status, created_at',
    })
  }
}

export const db = new PharmacyDB()
export type { OfflineMedicine, OfflineBill }
