'use client'

import { useState } from 'react'
import { Printer, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getBillItemsAction, getPharmacySettingsAction } from '@/app/(dashboard)/pos/bills/actions'
import { formatINR } from '@/lib/utils/currency'
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

      const itemRows = items.map((item, i) => `
        <tr class="${i % 2 === 1 ? 'alt' : ''}">
          <td class="name">${item.medicine_name ?? '—'}</td>
          <td class="right">${item.qty}</td>
          <td class="right">${fmtINR(item.sale_price)}</td>
          <td class="right bold">${fmtINR(item.price)}</td>
        </tr>
        <tr class="batch ${i % 2 === 1 ? 'alt' : ''}">
          <td colspan="4">Batch: ${item.batch_no}</td>
        </tr>
      `).join('')

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${bill.bill_no}</title>
<style>
  /* Default: thermal 80mm roll */
  @page { size: 80mm auto; margin: 10mm 2mm 5mm 2mm; }
  /* A4 fallback (when the user picks A4/Letter in the browser print dialog) */
  @page :first { margin-top: 25mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #fff; }
  body {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: #000;
    width: 76mm;
    max-width: 100%;
    margin: 0 auto;
    padding: 15mm 3mm 5mm 3mm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .right { text-align: right; }
  .shop-name { font-size: 16px; font-weight: 700; margin-top: 2mm; margin-bottom: 2px; }
  .shop-info { font-size: 10px; color: #333; line-height: 1.4; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .memo { font-size: 13px; font-weight: 700; letter-spacing: 1px; margin: 4px 0; }
  .meta { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; }
  .meta .label { color: #555; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead th { font-size: 10px; font-weight: 700; text-align: left; padding: 3px 2px; border-bottom: 1px solid #000; }
  thead th.right { text-align: right; }
  tbody td { padding: 2px 2px; vertical-align: top; }
  tbody td.name { word-break: break-word; }
  tr.batch td { font-size: 9px; color: #666; padding: 0 2px 3px 2px; }
  tr.alt td { background: #f5f5f5; }
  .totals { margin-top: 4px; }
  .totals .row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 1px; }
  .totals .row.label { color: #555; }
  .totals .grand { font-size: 14px; font-weight: 700; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px; }
  .footer { font-size: 10px; color: #555; text-align: center; margin-top: 8px; line-height: 1.4; }
  @media print {
    html, body { width: auto; }
    body {
      width: 76mm;
      max-width: 100%;
      margin: 0 auto;
      padding: 15mm 3mm 5mm 3mm;
    }
  }
</style></head>
<body>
  <div class="center">
    <div class="shop-name">${pharmacy.store_name || 'Pharmacy'}</div>
    <div class="shop-info">
      ${pharmacy.store_address ? pharmacy.store_address + '<br/>' : ''}
      ${pharmacy.store_phone ? 'Ph: ' + pharmacy.store_phone + '<br/>' : ''}
      ${pharmacy.store_gstin ? 'GSTIN: ' + pharmacy.store_gstin + '<br/>' : ''}
      ${pharmacy.store_dl ? 'DL No: ' + pharmacy.store_dl : ''}
    </div>
  </div>

  <div class="divider"></div>
  <div class="center memo">CASH MEMO</div>

  <div class="meta"><span class="label">Bill No.</span><span class="bold">${bill.bill_no}</span></div>
  <div class="meta"><span class="label">Date</span><span>${format(new Date(bill.bill_date), 'dd/MM/yyyy')}</span></div>
  ${bill.customer_name ? `<div class="meta"><span class="label">Customer</span><span>${bill.customer_name}</span></div>` : ''}
  ${bill.customer_phone ? `<div class="meta"><span class="label">Phone</span><span>${bill.customer_phone}</span></div>` : ''}
  ${bill.doctor ? `<div class="meta"><span class="label">Doctor</span><span>${bill.doctor}</span></div>` : ''}
  <div class="meta"><span class="label">Payment</span><span style="text-transform:uppercase">${bill.payment_method}</span></div>

  <div class="divider"></div>

  <table>
    <thead>
      <tr>
        <th>Medicine</th>
        <th class="right">Qty</th>
        <th class="right">Rate</th>
        <th class="right">Amt</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="divider"></div>

  <div class="totals">
    <div class="row"><span class="label">Subtotal</span><span>${fmtINR(bill.subtotal)}</span></div>
    ${bill.discount_total > 0 ? `<div class="row"><span class="label">Discount</span><span>- ${fmtINR(bill.discount_total)}</span></div>` : ''}
    ${bill.tax_total > 0 ? `<div class="row"><span class="label">Tax</span><span>+ ${fmtINR(bill.tax_total)}</span></div>` : ''}
    <div class="row grand"><span>TOTAL</span><span>${fmtINR(bill.total)}</span></div>
  </div>

  <div class="divider"></div>
  <div class="footer">
    ${pharmacy.invoice_footer || 'Thank you for your purchase!'}
    ${bill.note ? '<br/>Note: ' + bill.note : ''}
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); window.close(); }, 300);
    };
  </script>
</body></html>`

      const win = window.open('', '_blank', 'width=400,height=600')
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
