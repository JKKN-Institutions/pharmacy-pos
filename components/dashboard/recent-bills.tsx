import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { formatINR } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import type { PosBill } from '@/lib/types/database'

interface RecentBillsProps {
  bills: PosBill[]
}

const paymentBadgeClass: Record<string, string> = {
  cash: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
  card: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
  upi: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-400 dark:border-violet-800',
  credit: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
}

export function RecentBills({ bills }: RecentBillsProps) {
  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recent Bills</CardTitle>
      </CardHeader>
      <CardContent>
        {bills.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No bills yet</p>
        ) : (
          <div className="divide-y divide-border">
            {bills.map(bill => (
              <div key={bill.id} className="flex items-center justify-between py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-mono font-semibold text-muted-foreground">
                    {bill.bill_no.split('-')[1] ?? '??'}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">
                      {bill.customer_name ?? 'Walk-in'}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {bill.bill_no} · {format(new Date(bill.bill_date), 'dd MMM')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs capitalize hidden sm:flex',
                      paymentBadgeClass[bill.payment_method] ?? 'bg-muted text-muted-foreground'
                    )}
                  >
                    {bill.payment_method}
                  </Badge>
                  <span className="font-semibold text-sm tabular-nums">{formatINR(bill.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
