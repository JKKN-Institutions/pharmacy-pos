import { StatsCard } from '@/components/ui/stats-card'
import { ShoppingCart, TrendingUp, DollarSign, Package, AlertTriangle } from 'lucide-react'
import { formatINR } from '@/lib/utils/currency'

interface KpiCardsProps {
  todaySales: number
  totalSales: number
  monthExpenses: number
  medicineCount: number
  lowStockCount: number
}

export function KpiCards({ todaySales, totalSales, monthExpenses, medicineCount, lowStockCount }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatsCard
        title="Today's Sales"
        value={formatINR(todaySales)}
        description="POS bills today"
        icon={ShoppingCart}
        iconClassName="bg-blue-100 dark:bg-blue-900/30"
      />
      <StatsCard
        title="Total Revenue"
        value={formatINR(totalSales)}
        description="All time POS sales"
        icon={TrendingUp}
        iconClassName="bg-green-100 dark:bg-green-900/30"
      />
      <StatsCard
        title="Month Expenses"
        value={formatINR(monthExpenses)}
        description="This month"
        icon={DollarSign}
        iconClassName="bg-amber-100 dark:bg-amber-900/30"
      />
      <StatsCard
        title="Medicines"
        value={medicineCount}
        description={`${lowStockCount} low stock`}
        icon={lowStockCount > 0 ? AlertTriangle : Package}
        iconClassName={lowStockCount > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-purple-100 dark:bg-purple-900/30'}
      />
    </div>
  )
}
