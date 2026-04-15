'use client'

import { useState } from 'react'
import { Printer, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getBillItemsAction, getPharmacySettingsAction } from '@/app/(dashboard)/pos/bills/actions'
import { format } from 'date-fns'
import type { PosBill } from '@/lib/types/database'

interface Props {
  bill: PosBill
  showLabel?: boolean
  variant?: 'ghost' | 'outline' | 'default' | 'secondary'
}

export function PrintBillButton({ bill, showLabel = false, variant = 'ghost' }: Props) {
  const [loading, setLoading] = useState(false)

  async function handlePrint() {
    setLoading(true)
    try {
      const [itemsResult, pharmacy] = await Promise.all([
        getBillItemsAction(bill.id),
        getPharmacySettingsAction(),
      ])

      if (itemsResult.error || !itemsResult.data) {
        toast.error('Could not load bill items')
        return
      }

      const items = itemsResult.data as Array<{
        id: string
        medicine_name: string | null
        batch_no: string
        qty: number
        sale_price: number
        price: number
      }>

      const totalQty  = items.reduce((s, it) => s + Number(it.qty || 0), 0)
      const itemCount = items.length
      const statusKey  = (bill.status ?? '').toString()
      const statusText = statusKey.replace(/_/g, ' ')

      const itemRows = items.map((item, i) => `
        <tr${i % 2 === 1 ? ' class="alt"' : ''}>
          <td class="idx">${i + 1}</td>
          <td class="name">${escapeHtml(item.medicine_name ?? '—')}</td>
          <td class="batch">${escapeHtml(item.batch_no ?? '')}</td>
          <td class="right qty">${item.qty}</td>
          <td class="right price">${fmtINR(item.sale_price)}</td>
          <td class="right total">${fmtINR(item.price)}</td>
        </tr>
      `).join('')

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(bill.bill_no)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #fff; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 12px;
    color: #111;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .shop-title { text-align: center; font-size: 13px; font-weight: 600; color: #333; margin-bottom: 14mm; }
  .card { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }

  .card-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; gap: 12px; border-bottom: 1px solid #e5e7eb; }
  .head-left { display: flex; align-items: center; gap: 12px; }
  .head-icon {
    width: 34px; height: 34px; border-radius: 8px;
    background: #eef2ff; color: #4f46e5;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 16px;
  }
  .bill-no   { font-family: 'Courier New', monospace; font-size: 16px; font-weight: 700; letter-spacing: 0.5px; }
  .bill-date { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
  .status-saved, .status-synced { background: #dcfce7; color: #15803d; }
  .status-sync_error { background: #fee2e2; color: #b91c1c; }
  .status-cancelled  { background: #f3f4f6; color: #4b5563; }
  .status-pending    { background: #fef3c7; color: #92400e; }

  .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 14px 18px; border-bottom: 1px solid #e5e7eb; background: #fafafa; }
  .meta-cell  { border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; padding: 8px 12px; }
  .meta-label { font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.6px; }
  .meta-value { font-size: 13px; font-weight: 600; color: #111; margin-top: 2px; }
  .meta-sub   { font-size: 11px; color: #6b7280; margin-top: 1px; }

  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #f3f4f6; border-bottom: 1px solid #e5e7eb; }
  thead th { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.6px; padding: 10px 12px; text-align: left; }
  thead th.right { text-align: right; }
  tbody td { padding: 10px 12px; font-size: 12px; border-bottom: 1px solid #f1f1f1; }
  tbody tr:last-child td { border-bottom: 0; }
  tbody tr.alt td  { background: #fafafa; }
  tbody td.idx    { color: #9ca3af; font-size: 11px; width: 36px; }
  tbody td.name   { font-weight: 600; }
  tbody td.batch  { font-family: 'Courier New', monospace; color: #6b7280; font-size: 11px; width: 80px; }
  tbody td.right  { text-align: right; font-variant-numeric: tabular-nums; }
  tbody td.qty    { width: 60px; }
  tbody td.price  { width: 90px; color: #4b5563; }
  tbody td.total  { width: 100px; font-weight: 600; }

  .totals { background: #fafafa; padding: 12px 18px; border-top: 1px solid #e5e7eb; }
  .totals .row { display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; padding: 3px 0; }
  .totals .row.grand { font-size: 15px; font-weight: 700; color: #111; border-top: 1px solid #e5e7eb; margin-top: 6px; padding-top: 8px; }
  .totals .row.grand .amt { color: #4f46e5; }

  .side-pad { padding: 0 18px; }
  .note       { margin: 10px 0; padding: 8px 12px; border: 1px solid #fde68a; background: #fffbeb; border-radius: 6px; font-size: 11px; }
  .cancel-box { margin: 10px 0; padding: 8px 12px; border: 1px solid #fecaca; background: #fef2f2; border-radius: 6px; font-size: 11px; color: #991b1b; }

  @media print {
    .card { break-inside: avoid; }
  }
</style></head>
<body>
  <div class="shop-title">${escapeHtml(pharmacy.store_name || 'Pharmacy')}</div>

  <div class="card">
    <div class="card-head">
      <div class="head-left">
        <div class="head-icon">$</div>
        <div>
          <div class="bill-no">${escapeHtml(bill.bill_no)}</div>
          <div class="bill-date">${format(new Date(bill.bill_date), 'dd MMM yyyy, hh:mm a')}</div>
        </div>
      </div>
      <span class="status-badge status-${escapeHtml(statusKey)}">${escapeHtml(statusText)}</span>
    </div>

    <div class="meta-grid">
      <div class="meta-cell">
        <div class="meta-label">Customer</div>
        <div class="meta-value">${escapeHtml(bill.customer_name ?? 'Walk-in')}</div>
        ${bill.customer_phone ? `<div class="meta-sub">${escapeHtml(bill.customer_phone)}</div>` : ''}
      </div>
      <div class="meta-cell">
        <div class="meta-label">Payment</div>
        <div class="meta-value" style="text-transform:capitalize">${escapeHtml(bill.payment_method ?? '')}</div>
      </div>
      ${bill.doctor ? `
      <div class="meta-cell">
        <div class="meta-label">Doctor</div>
        <div class="meta-value">${escapeHtml(bill.doctor)}</div>
      </div>` : `
      <div class="meta-cell">
        <div class="meta-label">Items</div>
        <div class="meta-value">${itemCount} items, ${totalQty} qty</div>
      </div>`}
    </div>

    ${bill.status === 'cancelled' && bill.cancel_reason ? `
      <div class="side-pad">
        <div class="cancel-box">
          <strong>Cancelled${bill.cancelled_at ? ' on ' + format(new Date(bill.cancelled_at), 'dd MMM yyyy, hh:mm a') : ''}:</strong>
          ${escapeHtml(bill.cancel_reason)}
        </div>
      </div>
    ` : ''}

    ${bill.note ? `
      <div class="side-pad">
        <div class="note"><strong>Note:</strong> ${escapeHtml(bill.note)}</div>
      </div>
    ` : ''}

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Medicine</th>
          <th>Batch</th>
          <th class="right">Qty</th>
          <th class="right">Price</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${fmtINR(bill.subtotal)}</span></div>
      ${bill.discount_total > 0 ? `<div class="row"><span>Discount</span><span style="color:#dc2626">− ${fmtINR(bill.discount_total)}</span></div>` : ''}
      ${bill.tax_total > 0 ? `<div class="row"><span>Tax</span><span>+ ${fmtINR(bill.tax_total)}</span></div>` : ''}
      <div class="row grand"><span>Total</span><span class="amt">${fmtINR(bill.total)}</span></div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); window.close(); }, 300);
    };
  </script>
</body></html>`

      const win = window.open('', '_blank', 'width=900,height=1000')
      if (win) {
        win.document.write(html)
        win.document.close()
      } else {
        toast.error('Pop-up blocked — please allow pop-ups to print.')
      }
    } catch (err) {
      console.error('Print failed:', err)
      toast.error('Failed to print bill')
    } finally {
      setLoading(false)
    }
  }

  if (showLabel) {
    return (
      <Button variant={variant} size="sm" onClick={handlePrint} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
        Print
      </Button>
    )
  }

  return (
    <Button
      variant={variant}
      size="icon"
      className="h-8 w-8"
      title="Print receipt"
      onClick={handlePrint}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
    </Button>
  )
}

/** INR formatter for HTML context (Indian grouping: last 3 digits, then pairs of 2) */
function fmtINR(n: number) {
  const [int, dec] = n.toFixed(2).split('.')
  let lastThree = int.slice(-3)
  const rest = int.slice(0, -3)
  if (rest) {
    lastThree = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
  }
  return `₹${lastThree}.${dec}`
}

/** Prevent injection when pharmacy/customer fields contain HTML-sensitive characters. */
function escapeHtml(s: string | null | undefined): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
