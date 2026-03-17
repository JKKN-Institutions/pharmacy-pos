'use client'

import * as React from 'react'
import { useMemo, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Check, ChevronsUpDown, Users, Calendar, FileText, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { createPurchaseAction, updatePurchaseAction, getLastSalePricesBySupplierAction } from '@/app/(dashboard)/purchases/actions'
import type { PurchaseItemInput } from '@/app/(dashboard)/purchases/actions'
import { calculateLineItem } from '@/lib/utils/billing'
import { formatINR } from '@/lib/utils/currency'

const itemSchema = z.object({
  medicine_id: z.string().min(1, 'Select a medicine'),
  batch_no: z.string().min(1, 'Batch no. required'),
  expiry_date: z.string().min(1, 'Expiry date required'),
  packing_qty: z.coerce.number().min(1).default(1),
  quantity: z.coerce.number().min(1, 'Qty required'),
  free_qty: z.coerce.number().min(0).default(0),
  total_qty: z.coerce.number().min(1),
  purchase_price: z.coerce.number().min(0, 'Price required'),
  sale_price: z.coerce.number().min(0),
  discount_type: z.enum(['percent', 'flat']).default('percent'),
  discount_value: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
  // ── Derived breakdown — all set together in recalcItem() ──────────────────
  // Storing them avoids re-computing from potentially-stale watchedItems
  price: z.coerce.number().default(0),          // after discount + tax
  item_subtotal: z.coerce.number().default(0),  // qty × purchase_price
  item_discount: z.coerce.number().default(0),
  item_tax: z.coerce.number().default(0),
})

const schema = z.object({
  supplier_id: z.string().min(1, 'Supplier is required'),
  invoice_no: z.string().min(1, 'Invoice no. required'),
  purchase_date: z.string().min(1, 'Date required'),
  items: z.array(itemSchema).min(1, 'Add at least one item'),
})

type FormValues = z.infer<typeof schema>

type MedicineOption = { id: string; name: string; company: string | null; unit: string | null; tax_percent: number | null }

export interface PurchaseFormInitialData {
  id: string
  supplier_id: string
  invoice_no: string
  purchase_date: string
  items: Array<{
    medicine_id: string
    batch_no: string
    expiry_date: string
    packing_qty: number
    quantity: number
    free_qty: number
    total_qty: number
    purchase_price: number
    sale_price: number
    discount_type: 'percent' | 'flat'
    discount_value: number
    tax: number
    price: number
  }>
}

interface PurchaseFormProps {
  suppliers: { id: string; name: string }[]
  medicines: MedicineOption[]
  initialData?: PurchaseFormInitialData
}

// Searchable combobox for medicine selection.
// Pre-filters client-side before passing to Command so the DOM never holds
// 2000+ CommandItem nodes at once — which freezes cmdk's internal filter pass.
function MedicineCombobox({
  medicines,
  value,
  onValueChange,
}: {
  medicines: MedicineOption[]
  value: string
  onValueChange: (id: string, taxPercent: number) => void
}) {
  const [open, setOpen]     = React.useState(false)
  const [query, setQuery]   = useState('')
  const selected            = medicines.find((m) => m.id === value)

  // Pre-filter to ≤50 results so React renders a small list, not 2000+ nodes.
  // shouldFilter={false} on Command disables cmdk's own pass (we've done it).
  const filtered = useMemo(() => {
    if (!query.trim()) return medicines
    const q = query.toLowerCase()
    return medicines
      .filter((m) => m.name.toLowerCase().includes(q) || (m.company ?? '').toLowerCase().includes(q))
  }, [medicines, query])
  const visible = filtered.slice(0, 50)
  const hasMore = filtered.length > 50

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery('') }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-9 px-3 text-sm"
        >
          <span className="truncate">
            {selected ? selected.name : 'Select medicine'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={4}
      >
        {/* shouldFilter={false} — we pre-filter in `visible` above */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type to search medicine…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {query.length > 0 ? 'No medicine found.' : 'Start typing to search…'}
            </CommandEmpty>
            <CommandGroup>
              {visible.map((m) => (
                <CommandItem
                  key={m.id}
                  value={m.id}
                  onSelect={() => {
                    onValueChange(m.id, m.tax_percent ?? 0)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value === m.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm truncate">{m.name}</span>
                    {m.company && (
                      <span className="text-xs text-muted-foreground truncate">{m.company}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
              {hasMore && (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center border-t">
                  Showing 50 of {filtered.length} — type to narrow results
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

const defaultItem = {
  medicine_id: '',
  batch_no: '',
  expiry_date: '',
  packing_qty: 1,
  quantity: 1,
  free_qty: 0,
  total_qty: 1,
  purchase_price: 0,
  sale_price: 0,
  discount_type: 'percent' as const,
  discount_value: 0,
  tax: 0,
  price: 0,
  item_subtotal: 0,
  item_discount: 0,
  item_tax: 0,
}

export function PurchaseForm({ suppliers, medicines, initialData }: PurchaseFormProps) {
  const isEdit = !!initialData
  const [lastSalePrices, setLastSalePrices] = useState<Record<string, number>>({})
  const [loadingPrices, setLoadingPrices] = useState(false)

  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: initialData
      ? {
          supplier_id: initialData.supplier_id,
          invoice_no: initialData.invoice_no,
          purchase_date: initialData.purchase_date,
          items: initialData.items.map(item => {
            const line = calculateLineItem({
              qty: item.quantity,
              unit_price: item.purchase_price,
              discount_type: item.discount_type,
              discount_value: item.discount_value,
              tax: item.tax,
            })
            return {
              ...item,
              item_subtotal: line.subtotal,
              item_discount: line.discount,
              item_tax: line.tax_amount,
            }
          }),
        }
      : {
          supplier_id: '',
          invoice_no: '',
          purchase_date: new Date().toISOString().split('T')[0],
          items: [defaultItem],
        },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })
  const watchedItems = form.watch('items')

  // Fetch supplier-specific last sale prices when supplier changes
  const fetchLastSalePrices = React.useCallback(async (supplierId: string) => {
    if (!supplierId) { setLastSalePrices({}); return }
    setLoadingPrices(true)
    const result = await getLastSalePricesBySupplierAction(supplierId)
    setLastSalePrices(result.data)
    setLoadingPrices(false)
  }, [])

  // Auto-fetch on mount for edit mode (supplier is already set)
  React.useEffect(() => {
    if (initialData?.supplier_id) {
      fetchLastSalePrices(initialData.supplier_id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Summary totals ────────────────────────────────────────────────────────
  // Computed inline (not via useMemo) so they always reflect the current render.
  // useMemo([watchedItems]) would stay stale because RHF can return the same
  // array *reference* with mutated contents after form.setValue() calls.
  const subtotal      = watchedItems.reduce((s, i) => s + (i.item_subtotal || 0), 0)
  const discountTotal = watchedItems.reduce((s, i) => s + (i.item_discount || 0), 0)
  const taxTotal      = watchedItems.reduce((s, i) => s + (i.item_tax      || 0), 0)
  const grandTotal    = watchedItems.reduce((s, i) => s + (i.price         || 0), 0)
  const totals = { subtotal, discount_total: discountTotal, tax_total: taxTotal, total: grandTotal }

  async function onSubmit(values: FormValues) {
    const payload = {
      ...values,
      subtotal: totals.subtotal,
      discount: totals.discount_total,
      tax: totals.tax_total,
      total: totals.total,
    }
    const result = isEdit
      ? await updatePurchaseAction(initialData.id, payload)
      : await createPurchaseAction(payload)
    if (result?.error) toast.error(result.error)
  }

  // Recalculates ALL derived fields for one item using form.getValues() which
  // is always synchronous and reflects the just-typed value immediately.
  function recalcItem(index: number) {
    const item = form.getValues(`items.${index}`)
    const totalQty = (Number(item.packing_qty) || 1) * (Number(item.quantity) || 0)
    const line = calculateLineItem({
      qty: Number(item.quantity) || 0,
      unit_price: Number(item.purchase_price) || 0,
      discount_type: item.discount_type,
      discount_value: Number(item.discount_value) || 0,
      tax: Number(item.tax) || 0,
    })
    // Write all four derived values in one go — watchedItems will be consistent
    form.setValue(`items.${index}.total_qty`,    totalQty,      { shouldDirty: true })
    form.setValue(`items.${index}.price`,        line.price,    { shouldDirty: true })
    form.setValue(`items.${index}.item_subtotal`, line.subtotal, { shouldDirty: true })
    form.setValue(`items.${index}.item_discount`, line.discount, { shouldDirty: true })
    form.setValue(`items.${index}.item_tax`,     line.tax_amount, { shouldDirty: true })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* Purchase Header */}
        <Card>
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              {/* Suppliers — with icon adornment */}
              <FormField control={form.control} name="supplier_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Suppliers *</FormLabel>
                  <div className="flex rounded-md border overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                    <div className="flex items-center px-3 bg-muted border-r shrink-0">
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Select onValueChange={(v) => { field.onChange(v); fetchLastSalePrices(v) }} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="border-0 rounded-none flex-1 focus:ring-0 shadow-none h-9">
                          <SelectValue placeholder="Select Suppliers" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper">
                        {suppliers.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Invoice Number — with ¶ icon adornment */}
              <FormField control={form.control} name="invoice_no" render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Number *</FormLabel>
                  <div className="flex rounded-md border overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                    <div className="flex items-center px-3 bg-muted border-r shrink-0">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <FormControl>
                      <Input
                        className="border-0 rounded-none flex-1 focus-visible:ring-0 shadow-none h-9"
                        placeholder="Enter Invoice Number"
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Purchase Date — with calendar icon adornment */}
              <FormField control={form.control} name="purchase_date" render={({ field }) => (
                <FormItem className="sm:col-span-1">
                  <FormLabel>Purchase Date *</FormLabel>
                  <div className="flex rounded-md border overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                    <div className="flex items-center px-3 bg-muted border-r shrink-0">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <FormControl>
                      <Input
                        type="date"
                        className="border-0 rounded-none flex-1 focus-visible:ring-0 shadow-none h-9"
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

            </div>
          </CardContent>
        </Card>

        {/* Line Items — table layout */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Purchase Items ({fields.length})
            </h3>
            <Button
              type="button"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => append(defaultItem)}
            >
              <Plus className="w-4 h-4 mr-1.5" />Add Item
            </Button>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[1350px]">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-2 py-2.5 text-xs font-semibold text-muted-foreground w-10">#</th>
                  <th className="text-left px-2 py-2.5 text-xs font-semibold text-muted-foreground min-w-[220px]">Medicine *</th>
                  <th className="text-left px-2 py-2.5 text-xs font-semibold text-muted-foreground min-w-[100px]">Batch *</th>
                  <th className="text-left px-2 py-2.5 text-xs font-semibold text-muted-foreground min-w-[130px]">Expiry *</th>
                  <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground w-[75px]">Pack</th>
                  <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground w-[75px]">Qty *</th>
                  <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground w-[65px]">Free</th>
                  <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground w-[65px]">Total</th>
                  <th className="text-right px-2 py-2.5 text-xs font-semibold text-muted-foreground w-[100px]">P.Price *</th>
                  <th className="text-right px-2 py-2.5 text-xs font-semibold text-muted-foreground w-[100px]">S.Price *</th>
                  <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground min-w-[130px]">Discount</th>
                  <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground w-[70px]">Tax%</th>
                  <th className="text-right px-2 py-2.5 text-xs font-semibold text-muted-foreground w-[100px]">Amount</th>
                  <th className="w-10 px-1"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <tr key={field.id} className="border-t hover:bg-muted/30 align-top">
                    {/* # */}
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-600 text-white text-xs font-bold">
                        {index + 1}
                      </span>
                    </td>

                    {/* Medicine */}
                    <td className="px-2 py-2">
                      <FormField control={form.control} name={`items.${index}.medicine_id`} render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <MedicineCombobox
                              medicines={medicines}
                              value={field.value}
                              onValueChange={(id, taxPercent) => {
                                field.onChange(id)
                                form.setValue(`items.${index}.tax`, taxPercent, { shouldDirty: true })
                                recalcItem(index)
                              }}
                            />
                          </FormControl>
                          <FormMessage className="text-[10px] mt-1" />
                        </FormItem>
                      )} />
                    </td>

                    {/* Batch */}
                    <td className="px-2 py-2">
                      <FormField control={form.control} name={`items.${index}.batch_no`} render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input className="h-8 text-sm" placeholder="BN001" {...field} />
                          </FormControl>
                          <FormMessage className="text-[10px] mt-1" />
                        </FormItem>
                      )} />
                    </td>

                    {/* Expiry (month/year only) */}
                    <td className="px-2 py-2">
                      <FormField control={form.control} name={`items.${index}.expiry_date`} render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input className="h-8 text-sm" type="month" {...field} />
                          </FormControl>
                          <FormMessage className="text-[10px] mt-1" />
                        </FormItem>
                      )} />
                    </td>

                    {/* Pack Qty */}
                    <td className="px-2 py-2">
                      <FormField control={form.control} name={`items.${index}.packing_qty`} render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input
                              className="h-8 text-sm text-center no-spinner"
                              type="number"
                              min="1"
                              {...field}
                              onChange={e => { field.onChange(e); recalcItem(index) }}
                            />
                          </FormControl>
                        </FormItem>
                      )} />
                    </td>

                    {/* Quantity */}
                    <td className="px-2 py-2">
                      <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input
                              className="h-8 text-sm text-center no-spinner"
                              type="number"
                              min="1"
                              {...field}
                              onChange={e => { field.onChange(e); recalcItem(index) }}
                            />
                          </FormControl>
                          <FormMessage className="text-[10px] mt-1" />
                        </FormItem>
                      )} />
                    </td>

                    {/* Free Qty */}
                    <td className="px-2 py-2">
                      <FormField control={form.control} name={`items.${index}.free_qty`} render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input
                              className="h-8 text-sm text-center no-spinner"
                              type="number"
                              min="0"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )} />
                    </td>

                    {/* Total Qty (computed) */}
                    <td className="px-2 py-2">
                      <div className="h-8 flex items-center justify-center rounded-md bg-muted text-sm tabular-nums font-medium">
                        {watchedItems[index]
                          ? (Number(watchedItems[index].packing_qty) || 1) * (Number(watchedItems[index].quantity) || 0)
                          : 0}
                      </div>
                    </td>

                    {/* Purchase Price */}
                    <td className="px-2 py-2">
                      <FormField control={form.control} name={`items.${index}.purchase_price`} render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input
                              className="h-8 text-sm text-right no-spinner"
                              type="number"
                              step="0.01"
                              min="0"
                              {...field}
                              onChange={e => { field.onChange(e); recalcItem(index) }}
                            />
                          </FormControl>
                          <FormMessage className="text-[10px] mt-1" />
                        </FormItem>
                      )} />
                    </td>

                    {/* Sale Price */}
                    <td className="px-2 py-2">
                      <FormField control={form.control} name={`items.${index}.sale_price`} render={({ field }) => {
                        const medicineId = watchedItems[index]?.medicine_id
                        const suggestedPrice = medicineId ? lastSalePrices[medicineId] : undefined
                        const currentVal = Number(field.value) || 0
                        const showSuggestion = suggestedPrice && suggestedPrice > 0 && currentVal !== suggestedPrice
                        return (
                          <FormItem className="space-y-0">
                            <FormControl>
                              <Input
                                className="h-8 text-sm text-right no-spinner"
                                type="number"
                                step="0.01"
                                min="0"
                                {...field}
                              />
                            </FormControl>
                            {loadingPrices && medicineId && (
                              <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                              </span>
                            )}
                            {showSuggestion && (
                              <button
                                type="button"
                                className="mt-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap"
                                onClick={() => field.onChange(suggestedPrice)}
                              >
                                Prev: ₹{suggestedPrice}
                              </button>
                            )}
                          </FormItem>
                        )
                      }} />
                    </td>

                    {/* Discount (type + value) */}
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-0.5">
                        <FormField control={form.control} name={`items.${index}.discount_type`} render={({ field }) => (
                          <FormItem className="space-y-0">
                            <Select
                              value={field.value}
                              onValueChange={v => { field.onChange(v); recalcItem(index) }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-12 h-8 px-1.5 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="percent">%</SelectItem>
                                <SelectItem value="flat">₹</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`items.${index}.discount_value`} render={({ field }) => (
                          <FormItem className="space-y-0 flex-1">
                            <FormControl>
                              <Input
                                className="h-8 text-sm text-right no-spinner"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0"
                                {...field}
                                onChange={e => { field.onChange(e); recalcItem(index) }}
                              />
                            </FormControl>
                          </FormItem>
                        )} />
                      </div>
                    </td>

                    {/* Tax % */}
                    <td className="px-2 py-2">
                      <FormField control={form.control} name={`items.${index}.tax`} render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input
                              className="h-8 text-sm text-center no-spinner"
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0"
                              {...field}
                              onChange={e => { field.onChange(e); recalcItem(index) }}
                            />
                          </FormControl>
                        </FormItem>
                      )} />
                    </td>

                    {/* Amount (computed) */}
                    <td className="px-2 py-2">
                      <div className="h-8 flex items-center justify-end px-2 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-sm tabular-nums font-semibold text-green-700 dark:text-green-400 whitespace-nowrap">
                        {formatINR(watchedItems[index]?.price || 0)}
                      </div>
                    </td>

                    {/* Delete */}
                    <td className="px-1 py-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

        {/* Summary — right-aligned, plain decimal numbers matching reference */}
        <div className="flex justify-end">
          <div className="w-72 rounded-lg border overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr className="border-b">
                  <td className="py-2.5 px-4 text-muted-foreground border-r">Sub Total</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">{totals.subtotal.toFixed(2)}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2.5 px-4 text-muted-foreground border-r">Discount</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">{totals.discount_total.toFixed(2)}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2.5 px-4 text-muted-foreground border-r">Tax</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">{totals.tax_total.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-semibold text-base border-r">Amount</td>
                  <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-base">{totals.total.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-center pt-2">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full sm:w-auto px-12 bg-green-600 hover:bg-green-700 text-white"
          >
            {form.formState.isSubmitting ? 'Saving...' : isEdit ? 'Update Purchase' : 'Save'}
          </Button>
        </div>

      </form>
    </Form>
  )
}
