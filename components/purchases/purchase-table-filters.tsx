'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface PurchaseTableFiltersProps {
  currentStatus: string
  currentSupplier: string
  suppliers: { id: string; name: string }[]
}

export function PurchaseTableFilters({ currentStatus, currentSupplier, suppliers }: PurchaseTableFiltersProps) {
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
          <SelectItem value="received">Received</SelectItem>
          <SelectItem value="returned">Returned</SelectItem>
        </SelectContent>
      </Select>

      <Select value={currentSupplier || 'all'} onValueChange={(v) => update('supplier', v)}>
        <SelectTrigger className="flex-1 min-w-[120px] sm:flex-none sm:w-[160px] h-9 text-sm">
          <SelectValue placeholder="All Suppliers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Suppliers</SelectItem>
          {suppliers.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}
