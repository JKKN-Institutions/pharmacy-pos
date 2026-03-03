import { BillsTable } from '@/components/pos/bills-table'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Receipt, TrendingUp, Clock } from 'lucide-react'
import Link from 'next/link'
import { formatINR } from '@/lib/utils/currency'
import { Card, CardContent } from '@/components/ui/card'
import { fetchBillsAction, fetchBillsSummaryAction } from './actions'

export default async function PosBillsPage() {
  // Parallel fetch: first page of data + summary stats
  const [billsResult, summary] = await Promise.all([
    fetchBillsAction({ page: 0, pageSize: 15, sortBy: 'created_at', sortOrder: 'desc' }),
    fetchBillsSummaryAction(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="POS Billing History"
        description={`${billsResult.totalCount.toLocaleString()} bill records`}
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/pos">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to POS
          </Link>
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Revenue</p>
                <p className="text-xl font-bold tabular-nums">{formatINR(summary.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Today&apos;s Revenue</p>
                <p className="text-xl font-bold tabular-nums">{formatINR(summary.todayRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pending Bills</p>
                <p className="text-xl font-bold tabular-nums">{summary.pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <BillsTable
        initialData={billsResult.data as any}
        initialTotalCount={billsResult.totalCount}
      />
    </div>
  )
}
