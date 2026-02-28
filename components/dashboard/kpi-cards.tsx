import { StatsCard } from '@/components/ui/stats-card'
import { TrendingUp, Receipt, Users, ShoppingBag } from 'lucide-react'
import { formatINR } from '@/lib/utils/currency'

interface KpiCardsProps {
  totalIncome: number
  totalExpenses: number
  totalSalary: number
  totalPurchase: number
  todaySales: number
}

export function KpiCards({ totalIncome, totalExpenses, totalSalary, totalPurchase, todaySales }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
      <StatsCard
        title="Income"
        value={formatINR(totalIncome)}
        description={`Today: ${formatINR(todaySales)}`}
        icon={TrendingUp}
        iconClassName="bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400"
      />
      <StatsCard
        title="Expenses"
        value={formatINR(totalExpenses)}
        description="All-time operational"
        icon={Receipt}
        iconClassName="bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400"
      />
      <StatsCard
        title="Salary Expenses"
        value={formatINR(totalSalary)}
        description="All-time payroll"
        icon={Users}
        iconClassName="bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"
      />
      <StatsCard
        title="Purchase Total"
        value={formatINR(totalPurchase)}
        description="All-time procurement"
        icon={ShoppingBag}
        iconClassName="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
      />
    </div>
  )
}
