import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shown automatically by Next.js while any page inside (dashboard)
 * is resolving its server-side data. Matches the visual structure of
 * the most common dashboard pages (header + KPI row + chart grid).
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">

      {/* Page header */}
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-44 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>

      {/* KPI cards row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[112px] rounded-xl" />
        ))}
      </div>

      {/* Primary chart + side panel */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="lg:col-span-2 h-[280px] rounded-xl" />
        <Skeleton className="h-[280px] rounded-xl" />
      </div>

      {/* Secondary charts */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
        <Skeleton className="h-[220px] rounded-xl" />
        <Skeleton className="h-[220px] rounded-xl" />
      </div>

      {/* Tertiary row */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-[220px] rounded-xl" />
        <Skeleton className="h-[220px] rounded-xl" />
        <Skeleton className="h-[220px] rounded-xl" />
      </div>

    </div>
  )
}
