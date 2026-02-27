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
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <StatsCard
        title="Income"
        value={formatINR(totalIncome)}
        description={`Today: ${formatINR(todaySales)}`}
        icon={TrendingUp}
        iconClassName="bg-green-50 dark:bg-green-950/50"
      />
      <StatsCard
        title="Expenses"
        value={formatINR(totalExpenses)}
        description="All-time operational"
        icon={Receipt}
        iconClassName="bg-red-50 dark:bg-red-950/50"
      />
      <StatsCard
        title="Salary Expenses"
        value={formatINR(totalSalary)}
        description="All-time payroll"
        icon={Users}
        iconClassName="bg-amber-50 dark:bg-amber-950/50"
      />
      <StatsCard
        title="Purchase Total"
        value={formatINR(totalPurchase)}
        description="All-time procurement"
        icon={ShoppingBag}
        iconClassName="bg-blue-50 dark:bg-blue-950/50"
      />
    </div>
  )
}
