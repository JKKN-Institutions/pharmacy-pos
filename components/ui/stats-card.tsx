import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  trend?: {
    value: number
    label: string
    positive?: boolean
  }
  className?: string
  iconClassName?: string
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  iconClassName,
}: StatsCardProps) {
  return (
    <Card className={cn('rounded-xl border shadow-sm min-w-0 overflow-hidden py-0', className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="space-y-0.5 flex-1 min-w-0 overflow-hidden">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
            <p className="text-base sm:text-xl font-bold tracking-tight tabular-nums truncate">{value}</p>
            {description && (
              <p className="text-[11px] text-muted-foreground truncate">{description}</p>
            )}
            {trend && (
              <div className={cn(
                'flex items-center gap-1 text-xs font-medium',
                trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
              )}>
                {trend.positive
                  ? <TrendingUp className="h-3 w-3" />
                  : <TrendingDown className="h-3 w-3" />
                }
                <span>{trend.positive ? '+' : ''}{trend.value}% {trend.label}</span>
              </div>
            )}
          </div>
          {Icon && (
            <div className={cn(
              'flex h-8 w-8 sm:h-11 sm:w-11 items-center justify-center rounded-lg shrink-0',
              iconClassName ?? 'bg-primary/10'
            )}>
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
