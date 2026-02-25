import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
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
    <Card className="rounded-2xl h-full">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Expiring Soon
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No items expiring in 30 days</p>
        ) : (
          <div className="space-y-3">
            {items.map(item => {
              const days = differenceInDays(new Date(item.expiry_date), new Date())
              return (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{item.medicines?.name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      Batch {item.batch_no} · {item.available_qty} units
                    </div>
                  </div>
                  <span className={cn(
                    'text-xs font-semibold px-2 py-0.5 rounded-full',
                    days <= 7 ? 'bg-red-100 text-red-700 dark:bg-red-900/30' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30'
                  )}>
                    {days}d left
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
