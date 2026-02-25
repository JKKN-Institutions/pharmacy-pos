import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import { formatINR } from '@/lib/utils/currency'
import type { PosBill } from '@/lib/types/database'

interface RecentBillsProps {
  bills: PosBill[]
}

export function RecentBills({ bills }: RecentBillsProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base">Recent Bills</CardTitle>
      </CardHeader>
      <CardContent>
        {bills.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No bills yet</p>
        ) : (
          <div className="divide-y divide-border">
            {bills.map(bill => (
              <div key={bill.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-sm font-mono">{bill.bill_no}</div>
                  <div className="text-xs text-muted-foreground">
                    {bill.customer_name ?? 'Walk-in'} · {format(new Date(bill.bill_date), 'dd MMM')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-sm">{formatINR(bill.total)}</div>
                  <div className="text-xs text-muted-foreground capitalize">{bill.payment_method}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
