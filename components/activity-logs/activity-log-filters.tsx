'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ReportDateFilter } from '@/components/reports/report-date-filter'

const ACTION_OPTIONS = [
  'CREATE', 'UPDATE', 'DELETE', 'CANCEL',
  'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT',
]

const ENTITY_OPTIONS = [
  'medicine', 'purchase', 'pos_bill', 'invoice',
  'user', 'stock_batch', 'expense', 'salary',
  'customer', 'supplier', 'medicine_category', 'tax_rate',
]

interface ActivityLogFiltersProps {
  currentAction: string
  currentEntityType: string
}

export function ActivityLogFilters({
  currentAction,
  currentEntityType,
}: ActivityLogFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const update = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams.toString())
    if (!value || value === 'all') p.delete(key)
    else p.set(key, value)
    p.delete('page')
    router.replace(`${pathname}?${p.toString()}`)
  }

  return (
    <>
      <Select
        value={currentAction || 'all'}
        onValueChange={(v) => update('action', v)}
      >
        <SelectTrigger className="flex-1 min-w-[120px] sm:flex-none sm:w-[140px] h-9 text-sm">
          <SelectValue placeholder="All Actions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Actions</SelectItem>
          {ACTION_OPTIONS.map((a) => (
            <SelectItem key={a} value={a}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentEntityType || 'all'}
        onValueChange={(v) => update('entity_type', v)}
      >
        <SelectTrigger className="flex-1 min-w-[130px] sm:flex-none sm:w-[160px] h-9 text-sm">
          <SelectValue placeholder="All Entities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Entities</SelectItem>
          {ENTITY_OPTIONS.map((e) => (
            <SelectItem key={e} value={e} className="capitalize">
              {e.replace(/_/g, ' ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ReportDateFilter />
    </>
  )
}
