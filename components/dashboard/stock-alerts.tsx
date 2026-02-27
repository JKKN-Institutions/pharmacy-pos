import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { cn } from '@/lib/utils'

interface StockAlertsProps {
  items: Array<{
    id: string
    batch_no: string
    expiry_date: string
    available_qty: number
    medicines?: { name: string } | null
  }>
}

export function StockAlerts({ items }: StockAlertsProps) {
  return (
    <Card className="rounded-xl h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Expiring Soon
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/50">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm text-muted-foreground">All clear — no items expiring in 30 days</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => {
              const days = differenceInDays(new Date(item.expiry_date), new Date())
              const isUrgent = days <= 7

              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-lg p-2.5 text-sm',
                    isUrgent
                      ? 'bg-red-50/80 dark:bg-red-950/20'
                      : 'bg-amber-50/60 dark:bg-amber-950/20'
                  )}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{item.medicines?.name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Batch {item.batch_no} · {item.available_qty} units
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'shrink-0 font-semibold text-xs',
                      isUrgent
                        ? 'border-red-300 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-400'
                        : 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                    )}
                  >
                    {days}d left
                  </Badge>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
