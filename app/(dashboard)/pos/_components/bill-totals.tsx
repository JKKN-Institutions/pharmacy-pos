import { formatINR } from '@/lib/utils/currency'

interface BillTotalsProps {
  totals: {
    subtotal: number
    discount_total: number
    tax_total: number
    total: number
  }
}

export function BillTotals({ totals }: BillTotalsProps) {
  return (
    <div className="border-t px-4 py-3 flex flex-col items-end gap-1 text-sm">
      <div className="flex gap-8 text-muted-foreground">
        <span>Subtotal:</span>
        <span className="w-24 text-right">{formatINR(totals.subtotal)}</span>
      </div>
      {totals.discount_total > 0 && (
        <div className="flex gap-8 text-green-600">
          <span>Discount:</span>
          <span className="w-24 text-right">- {formatINR(totals.discount_total)}</span>
        </div>
      )}
      {totals.tax_total > 0 && (
        <div className="flex gap-8 text-muted-foreground">
          <span>Tax:</span>
          <span className="w-24 text-right">{formatINR(totals.tax_total)}</span>
        </div>
      )}
      <div className="flex gap-8 font-bold text-base border-t pt-2 mt-1">
        <span>Total:</span>
        <span className="w-24 text-right">{formatINR(totals.total)}</span>
      </div>
    </div>
  )
}
