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
    <div className="border-t bg-muted/30 px-5 py-4">
      <div className="flex justify-end">
        <div className="w-56 space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatINR(totals.subtotal)}</span>
          </div>

          {totals.discount_total > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Discount</span>
              <span className="tabular-nums">− {formatINR(totals.discount_total)}</span>
            </div>
          )}

          {totals.tax_total > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span className="tabular-nums">+ {formatINR(totals.tax_total)}</span>
            </div>
          )}

          <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
            <span>Total</span>
            <span className="tabular-nums text-primary">{formatINR(totals.total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
