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
    <div className="border-t px-5 py-4 bg-muted/20">
      <div className="flex justify-end">
        {/* Plain decimal numbers matching reference — no ₹ symbol */}
        <div className="w-72 rounded-lg border overflow-hidden text-sm border-collapse">
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-b border-border">
                <td className="py-2.5 px-4 text-muted-foreground font-medium border-r border-border">
                  Sub Total
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums">
                  {totals.subtotal.toFixed(2)}
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2.5 px-4 text-muted-foreground font-medium border-r border-border">
                  Discount
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums">
                  {totals.discount_total.toFixed(2)}
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2.5 px-4 text-muted-foreground font-medium border-r border-border">
                  Tax
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums">
                  {totals.tax_total.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-bold text-base border-r border-border">
                  Amount
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums font-bold text-base">
                  {totals.total.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
