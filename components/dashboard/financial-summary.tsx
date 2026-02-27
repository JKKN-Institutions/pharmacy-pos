import { formatINR } from '@/lib/utils/currency'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, Receipt, Wallet, AlertCircle, Tag, CreditCard } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface FinancialSummaryProps {
  totalIncome: number
  totalTax: number
  totalPaid: number
  totalDue: number
  totalDiscount: number
  totalExpenses: number
}

const metrics: {
  key: keyof FinancialSummaryProps
  label: string
  icon: LucideIcon
  color: string
  bg: string
}[] = [
  { key: 'totalIncome',   label: 'Total Income',   icon: TrendingUp,   color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-50 dark:bg-green-950/30' },
  { key: 'totalTax',      label: 'Total Tax',       icon: Receipt,      color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-950/30' },
  { key: 'totalPaid',     label: 'Paid',            icon: Wallet,       color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { key: 'totalDue',      label: 'Due Amount',      icon: AlertCircle,  color: 'text-red-600 dark:text-red-400',      bg: 'bg-red-50 dark:bg-red-950/30' },
  { key: 'totalDiscount', label: 'Total Discount',  icon: Tag,          color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/30' },
  { key: 'totalExpenses', label: 'Total Expenses',  icon: CreditCard,   color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/30' },
]

export function FinancialSummary(props: FinancialSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {metrics.map(({ key, label, icon: Icon, color, bg }) => (
        <Card key={key} className="rounded-xl border shadow-sm">
          <CardContent className="p-4">
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className={`text-base font-bold tabular-nums mt-0.5 ${color}`}>
              {formatINR(props[key])}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
