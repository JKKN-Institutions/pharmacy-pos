'use client'

import * as React from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'
import { CalendarIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { DateRange } from 'react-day-picker'

type FilterMode = 'today' | 'date' | 'month' | 'year' | 'custom'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function getYearOptions() {
  const currentYear = new Date().getFullYear()
  const years: number[] = []
  for (let y = currentYear; y >= currentYear - 10; y--) {
    years.push(y)
  }
  return years
}

function detectMode(from?: string, to?: string): FilterMode | null {
  if (!from && !to) return null
  if (!from || !to) return 'custom'

  const today = format(new Date(), 'yyyy-MM-dd')
  if (from === today && to === today) return 'today'

  // Check if it's a single date
  if (from === to) return 'date'

  // Check if it's a full month
  const fromDate = new Date(from + 'T00:00:00')
  const monthStart = format(startOfMonth(fromDate), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(fromDate), 'yyyy-MM-dd')
  if (from === monthStart && to === monthEnd) return 'month'

  // Check if it's a full year
  const yearStart = format(startOfYear(fromDate), 'yyyy-MM-dd')
  const yearEnd = format(endOfYear(fromDate), 'yyyy-MM-dd')
  if (from === yearStart && to === yearEnd) return 'year'

  return 'custom'
}

export function ReportDateFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const from = searchParams.get('from') ?? undefined
  const to = searchParams.get('to') ?? undefined

  const activeMode = detectMode(from, to)

  const [popoverOpen, setPopoverOpen] = React.useState(false)
  const [mode, setMode] = React.useState<FilterMode>(activeMode ?? 'today')

  // State for date picker
  const [singleDate, setSingleDate] = React.useState<Date | undefined>(
    from ? new Date(from + 'T00:00:00') : undefined
  )

  // State for month picker
  const fromDate = from ? new Date(from + 'T00:00:00') : new Date()
  const [selectedMonth, setSelectedMonth] = React.useState(String(fromDate.getMonth()))
  const [selectedMonthYear, setSelectedMonthYear] = React.useState(String(fromDate.getFullYear()))

  // State for year picker
  const [selectedYear, setSelectedYear] = React.useState(String(fromDate.getFullYear()))

  // State for custom range
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(
    from && to
      ? { from: new Date(from + 'T00:00:00'), to: new Date(to + 'T00:00:00') }
      : undefined
  )

  function pushDates(newFrom: string, newTo: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('from', newFrom)
    params.set('to', newTo)
    // Remove page param so we go back to page 1
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
    setPopoverOpen(false)
  }

  function clearFilter() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('from')
    params.delete('to')
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
    setPopoverOpen(false)
  }

  function applyFilter() {
    switch (mode) {
      case 'today': {
        const today = format(new Date(), 'yyyy-MM-dd')
        pushDates(today, today)
        break
      }
      case 'date': {
        if (!singleDate) return
        const d = format(singleDate, 'yyyy-MM-dd')
        pushDates(d, d)
        break
      }
      case 'month': {
        const date = new Date(Number(selectedMonthYear), Number(selectedMonth), 1)
        pushDates(
          format(startOfMonth(date), 'yyyy-MM-dd'),
          format(endOfMonth(date), 'yyyy-MM-dd')
        )
        break
      }
      case 'year': {
        const date = new Date(Number(selectedYear), 0, 1)
        pushDates(
          format(startOfYear(date), 'yyyy-MM-dd'),
          format(endOfYear(date), 'yyyy-MM-dd')
        )
        break
      }
      case 'custom': {
        if (!dateRange?.from || !dateRange?.to) return
        pushDates(
          format(dateRange.from, 'yyyy-MM-dd'),
          format(dateRange.to, 'yyyy-MM-dd')
        )
        break
      }
    }
  }

  // Label for the trigger button
  function getActiveLabel(): string {
    if (!from && !to) return 'Filter by date'
    if (activeMode === 'today') return 'Today'
    if (activeMode === 'date' && from) {
      return format(new Date(from + 'T00:00:00'), 'dd MMM yyyy')
    }
    if (activeMode === 'month' && from) {
      const d = new Date(from + 'T00:00:00')
      return format(d, 'MMMM yyyy')
    }
    if (activeMode === 'year' && from) {
      return new Date(from + 'T00:00:00').getFullYear().toString()
    }
    if (from && to) {
      return `${format(new Date(from + 'T00:00:00'), 'dd MMM')} - ${format(new Date(to + 'T00:00:00'), 'dd MMM yyyy')}`
    }
    return 'Filter by date'
  }

  const isFiltered = !!(from || to)

  return (
    <div className="flex items-center gap-1.5">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'gap-1.5 text-xs sm:text-sm',
              isFiltered && 'border-primary/50 bg-primary/5 text-primary'
            )}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span className="hidden xs:inline sm:inline">{getActiveLabel()}</span>
            <span className="xs:hidden sm:hidden">Date</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="p-3 space-y-3">
            {/* Mode tabs */}
            <div className="flex gap-1 flex-wrap">
              {([
                ['today', 'Today'],
                ['date', 'Date'],
                ['month', 'Month'],
                ['year', 'Year'],
                ['custom', 'Custom'],
              ] as [FilterMode, string][]).map(([key, label]) => (
                <Button
                  key={key}
                  variant={mode === key ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => setMode(key)}
                >
                  {label}
                </Button>
              ))}
            </div>

            {/* Mode-specific content */}
            {mode === 'today' && (
              <p className="text-xs text-muted-foreground px-1">
                Shows records for {format(new Date(), 'dd MMMM yyyy')}
              </p>
            )}

            {mode === 'date' && (
              <Calendar
                mode="single"
                selected={singleDate}
                onSelect={setSingleDate}
                className="rounded-md border"
              />
            )}

            {mode === 'month' && (
              <div className="flex gap-2">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedMonthYear} onValueChange={setSelectedMonthYear}>
                  <SelectTrigger className="w-[90px] h-9">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {getYearOptions().map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {mode === 'year' && (
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px] h-9">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {getYearOptions().map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {mode === 'custom' && (
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={1}
                className="rounded-md border"
              />
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-1 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={clearFilter}
              >
                Clear
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={applyFilter}
                disabled={
                  (mode === 'date' && !singleDate) ||
                  (mode === 'custom' && (!dateRange?.from || !dateRange?.to))
                }
              >
                Apply Filter
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={clearFilter}
          title="Clear date filter"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  )
}
