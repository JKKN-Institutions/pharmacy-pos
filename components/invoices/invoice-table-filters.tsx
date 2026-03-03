'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface InvoiceTableFiltersProps {
  currentStatus: string
  currentPayment: string
}

export function InvoiceTableFilters({ currentStatus, currentPayment }: InvoiceTableFiltersProps) {
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
      <Select value={currentStatus || 'all'} onValueChange={(v) => update('status', v)}>
        <SelectTrigger className="flex-1 min-w-[120px] sm:flex-none sm:w-[140px] h-9 text-sm">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="sent">Sent</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      <Select value={currentPayment || 'all'} onValueChange={(v) => update('payment', v)}>
        <SelectTrigger className="flex-1 min-w-[120px] sm:flex-none sm:w-[150px] h-9 text-sm">
          <SelectValue placeholder="All Payments" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Payments</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="partial">Partial</SelectItem>
          <SelectItem value="unpaid">Unpaid</SelectItem>
        </SelectContent>
      </Select>
    </>
  )
}
