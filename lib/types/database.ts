// ─── User / Auth ─────────────────────────────────────────────────────────────

export type DiscountType = 'percent' | 'flat'

export type UserRole = 'admin' | 'manager' | 'pharmacist' | 'cashier'

export interface UserProfile {
  id: string
  auth_user_id: string
  name: string
  email: string
  phone: string | null
  role: UserRole
  branch_id: string
  created_at: string
  updated_at: string
}

// ─── Medicines ────────────────────────────────────────────────────────────────

export interface Medicine {
  id: string
  branch_id: string
  name: string
  generic_name: string | null
  company: string | null
  category: string | null
  category_id: string | null
  hsn_code: string | null
  manufacturer: string | null
  unit: string
  unit_packing: string | null
  medicine_group: string | null
  store_location: string | null
  rack_location: string | null
  min_level: number
  reorder_level: number
  tax_percent: number
  status: 'active' | 'inactive'
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Stock Batches ────────────────────────────────────────────────────────────

export interface StockBatch {
  id: string
  branch_id: string
  medicine_id: string
  purchase_id: string | null
  batch_no: string        // real DB column name
  expiry_date: string     // ISO date string
  initial_qty: number
  sold_qty: number
  available_qty: number
  purchase_price: number
  sale_price: number
  status: 'active' | 'expired' | 'exhausted' | 'written_off'
  created_at: string
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

export interface Supplier {
  id: string
  branch_id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  pincode: string | null
  gstin: string | null
  dl_number: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Purchases ────────────────────────────────────────────────────────────────

export type PurchaseStatus = 'received' | 'returned' | 'partial_return'

export interface Purchase {
  id: string
  branch_id: string
  invoice_no: string            // Supplier invoice reference
  supplier_id: string
  purchase_date: string
  subtotal: number
  discount: number
  tax: number
  total: number
  status: PurchaseStatus
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface PurchaseItem {
  id: string
  purchase_id: string
  medicine_id: string
  medicine_name: string
  batch_number: string
  expiry_date: string
  quantity: number
  cost_price: number
  selling_price: number
  mrp: number
  total: number
}

// ─── POS Bills ────────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'card' | 'upi' | 'credit'
export type BillStatus = 'saved' | 'synced' | 'sync_error'

export interface PosBill {
  id: string
  branch_id: string
  bill_no: string               // INV-00001
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  doctor: string | null
  bill_date: string
  subtotal: number
  discount_total: number
  tax_total: number
  total: number
  paid: number
  due: number
  payment_method: PaymentMethod
  status: BillStatus
  note: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface PosBillItem {
  id: string
  bill_id: string
  medicine_id: string
  medicine_name: string
  stock_batch_id: string
  batch_no: string
  expiry_date: string
  quantity: number
  unit_price: number
  discount_type: 'percent' | 'flat'
  discount_value: number
  discount_amount: number
  tax_percent: number
  tax_amount: number
  total: number
}

// ─── Invoices (credit/institutional) ─────────────────────────────────────────

export type InvoicePaymentStatus = 'paid' | 'partial' | 'unpaid'
export type InvoiceStatus = 'draft' | 'sent' | 'paid'

export interface Invoice {
  id: string
  branch_id: string
  invoice_no: string            // INV-XXXXX
  customer_id: string | null
  payment_method: PaymentMethod
  payment_status: InvoicePaymentStatus
  invoice_status: InvoiceStatus
  invoice_date: string
  due_date: string | null
  subtotal: number
  discount_total: number
  tax_total: number
  total: number
  paid: number
  due: number
  customer_note: string | null
  terms_conditions: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  item_name: string
  item_description: string | null
  qty: number
  unit_cost: number
  discount_type: 'percent' | 'flat'
  discount_value: number
  tax: number
  price: number
}

// ─── Customers ────────────────────────────────────────────────────────────────

export interface Customer {
  id: string
  branch_id: string
  first_name: string
  last_name: string | null
  phone: string
  email: string | null
  blood_group: string | null
  dob: string | null
  gender: 'male' | 'female' | 'other' | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  pincode: string | null
  loyalty_points: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Stock Adjustments ────────────────────────────────────────────────────────

export type AdjustmentType = 'increase' | 'decrease'
export type AdjustmentReason =
  | 'Damaged'
  | 'Expired'
  | 'Miscounted'
  | 'Manual Correction'
  | 'Other'

export interface StockAdjustment {
  id: string
  branch_id: string
  medicine_id: string
  medicine_name: string
  batch_id: string | null
  type: AdjustmentType
  quantity: number
  reason: AdjustmentReason
  notes: string | null
  adjusted_by: string
  date: string
  created_at: string
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export interface Expense {
  id: string
  branch_id: string
  name: string
  expense_type: string
  amount: number
  method: string
  date: string
  description: string | null
  created_by: string | null
  created_at: string
}

// ─── Salary Records ───────────────────────────────────────────────────────────

export interface SalaryRecord {
  id: string
  branch_id: string
  staff_name: string
  amount: number
  method: string
  date: string
  note: string | null
  created_by: string | null
  created_at: string
}

// ─── Medicine Categories ──────────────────────────────────────────────────────

export interface MedicineCategory {
  id: string
  branch_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Tax Rates ────────────────────────────────────────────────────────────────

export interface TaxRate {
  id: string
  branch_id: string
  name: string
  rate: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── System Settings ──────────────────────────────────────────────────────────

export interface SystemSetting {
  id: string
  key: string
  value: string
  created_at: string
  updated_at: string
}

// ─── Offline / IndexedDB (Dexie) ─────────────────────────────────────────────

export interface OfflineMedicine {
  id: string
  name: string
  generic_name: string
  category: string
  unit: string
  batches: OfflineBatch[]
  updated_at: string
}

export interface OfflineBatch {
  id: string
  batch_number: string
  expiry_date: string
  available_qty: number
  selling_price: number
  mrp: number
}

export interface OfflineBillQueue {
  id: string            // local UUID
  bill_data: PosBill
  bill_items: PosBillItem[]
  created_at: string
  sync_status: 'pending' | 'synced' | 'failed'
  sync_attempts: number
}

// ─── POS Cart (Zustand runtime only) ─────────────────────────────────────────

export interface CartItem {
  medicine_id: string
  medicine_name: string
  batch_id: string
  batch_number: string
  expiry_date: string
  available_qty: number
  quantity: number
  unit_price: number
  mrp: number
  discount_type: 'percent' | 'flat'
  discount_value: number
  discount_amount: number
  tax_percent: number
  tax_amount: number
  total: number
}
