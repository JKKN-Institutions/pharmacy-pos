import type { DiscountType } from '@/lib/types/database'

export interface LineItemInput {
  qty: number
  unit_price: number
  discount_type: DiscountType
  discount_value: number
  tax: number
}

export interface LineItemTotals {
  subtotal: number
  discount: number
  tax_amount: number
  price: number
}

export function calculateLineItem(item: LineItemInput): LineItemTotals {
  const subtotal = item.qty * item.unit_price

  const discount =
    item.discount_type === 'percent'
      ? subtotal * (item.discount_value / 100)
      : item.discount_value

  const taxable = subtotal - discount
  const tax_amount = taxable * (item.tax / 100)
  const price = taxable + tax_amount

  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    tax_amount: round2(tax_amount),
    price: round2(price),
  }
}

export function calculateBillTotals(items: LineItemTotals[]) {
  return {
    subtotal: round2(items.reduce((s, i) => s + i.subtotal, 0)),
    discount_total: round2(items.reduce((s, i) => s + i.discount, 0)),
    tax_total: round2(items.reduce((s, i) => s + i.tax_amount, 0)),
    total: round2(items.reduce((s, i) => s + i.price, 0)),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
