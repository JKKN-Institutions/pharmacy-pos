'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  ArrowLeft,
  Receipt,
  TrendingUp,
  Clock,
  ShoppingCart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatINR } from '@/lib/utils/currency'
import { BillsTable } from '@/components/pos/bills-table'
import { PosForm } from './pos-client'
import { syncMedicines } from '@/lib/offline/sync'
import type { PosBill } from '@/lib/types/database'

interface PosPageClientProps {
  userId?: string
  branchId?: string
  bills: PosBill[]
  totalBills: number
  totalRevenue: number
  todayRevenue: number
  pendingCount: number
}

const kpiCards = [
  {
    key: 'revenue',
    label: 'Total Revenue',
    icon: Receipt,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  {
    key: 'today',
    label: "Today's Revenue",
    icon: TrendingUp,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
  },
  {
    key: 'pending',
    label: 'Pending Bills',
    icon: Clock,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
  },
  {
    key: 'total',
    label: 'Total Bills',
    icon: ShoppingCart,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-100 dark:bg-violet-900/30',
  },
]

export function PosPageClient({
  userId,
  branchId,
  bills,
  totalBills,
  totalRevenue,
  todayRevenue,
  pendingCount,
}: PosPageClientProps) {
  const [view, setView] = useState<'history' | 'new-bill'>('history')
  const router = useRouter()

  // Pre-warm medicine catalog in IndexedDB so it's ready when the user starts billing
  useEffect(() => {
    syncMedicines()
  }, [])

  function handleBillSaved() {
    setView('history')
    router.refresh()
  }

  /* ── New Bill View ──────────────────────────────────────── */
  if (view === 'new-bill') {
    return (
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">New Bill</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView('history')}
            className="h-8 gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to POS/Bill
          </Button>
        </div>

        {/* Form */}
        <PosForm
          userId={userId}
          branchId={branchId}
          onSaved={handleBillSaved}
          onCancel={() => setView('history')}
        />
      </div>
    )
  }

  /* ── History View (default) ─────────────────────────────── */
  const kpiValues: Record<string, string | number> = {
    revenue: formatINR(totalRevenue),
    today:   formatINR(todayRevenue),
    pending: pendingCount,
    total:   totalBills,
  }

  return (
    <div className="space-y-6">

      {/* ── Page header: POS/Bill title + New Bill button (desktop) ─── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">POS/Bill</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalBills} bill{totalBills !== 1 ? 's' : ''} recorded
          </p>
        </div>
        {/* Desktop button — hidden on mobile (FAB used instead) */}
        <Button
          onClick={() => setView('new-bill')}
          className="hidden sm:flex gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Bill
        </Button>
      </div>

      {/* ── KPI cards: 1-col on mobile, 2-col on tablet, 4-col on desktop ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {kpiCards.map(({ key, label, icon: Icon, color, bg }) => (
          <Card key={key} className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-3.5 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider leading-tight">
                    {label}
                  </p>
                  <p className="text-base sm:text-xl font-bold tabular-nums mt-0.5 truncate">
                    {kpiValues[key]}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Mobile FAB: New Bill (fixed, above bottom nav) ────────────── */}
      <Button
        onClick={() => setView('new-bill')}
        size="icon"
        className="sm:hidden fixed bottom-[72px] right-4 z-50 h-12 w-12 rounded-full shadow-xl"
        aria-label="New Bill"
      >
        <Plus className="w-5 h-5" />
      </Button>

      {/* ── Bills table ───────────────────────────────────────────────────── */}
      <BillsTable bills={bills} />

    </div>
  )
}
