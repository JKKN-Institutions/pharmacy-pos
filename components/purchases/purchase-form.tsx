'use client'

import * as React from 'react'
import { useMemo, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Check, ChevronsUpDown, Users, Calendar, FileText, Trash2, Loader2, ArrowLeft, Save } from 'lucide-react'
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
import { format } from 'date-fns'

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
  price: z.coerce.number().default(0),
  item_subtotal: z.coerce.number().default(0),
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

// ── Medicine combobox ─────────────────────────────────────────────────────────

function MedicineCombobox({
  medicines,
  value,
  onValueChange,
}: {
  medicines: MedicineOption[]
  value: string
  onValueChange: (id: string, taxPercent: number) => void
}) {
  const [open, setOpen]   = React.useState(false)
  const [query, setQuery] = useState('')
  const selected          = medicines.find((m) => m.id === value)

  // Step 1: dedup by id (guards against paginated-fetch duplicates)
  // Step 2: dedup by name case-insensitively (guards against same medicine
  //         added twice in DB — different IDs, same name)
  const uniqueMedicines = useMemo(() => {
    const byId = Array.from(new Map(medicines.map((m) => [m.id, m])).values())
    const seenNames = new Set<string>()
    return byId.filter((m) => {
      const key = m.name.toLowerCase().trim()
      if (seenNames.has(key)) return false
      seenNames.add(key)
      return true
    })
  }, [medicines])

  const filtered = useMemo(() => {
    if (!query.trim()) return uniqueMedicines
    const q = query.toLowerCase()
    return uniqueMedicines.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.company ?? '').toLowerCase().includes(q),
    )
  }, [uniqueMedicines, query])

  const visible = filtered.slice(0, 50)
  const hasMore = filtered.length > 50

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery('') }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-8 px-2 text-sm"
        >
          <span className="truncate">
            {selected ? selected.name : 'Select medicine'}
          </span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="min-w-[320px] w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={4}
      >
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
                  <span className="text-sm break-words">{m.name}</span>
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

// ── Purchase Preview ──────────────────────────────────────────────────────────

interface PreviewData {
  supplier_id: string
  invoice_no: string
  purchase_date: string
  items: FormValues['items']
  subtotal: number
  discount_total: number
  tax_total: number
  total: number
}

function PurchasePreview({
  data,
  supplierName,
  medicines,
  onEdit,
  onConfirm,
  saving,
}: {
  data: PreviewData
  supplierName: string
  medicines: MedicineOption[]
  onEdit: () => void
  onConfirm: () => void
  saving: boolean
}) {
  const medicineMap = useMemo(
    () => new Map(medicines.map((m) => [m.id, m.name])),
    [medicines],
  )

  return (
    <div className="space-y-6">

      {/* ── Header card ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-base font-semibold">Purchase Preview</h2>
          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-medium border border-amber-200 dark:border-amber-700">
            Review before saving
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Supplier</p>
            <p className="font-semibold">{supplierName}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Invoice No</p>
            <p className="font-mono font-semibold">{data.invoice_no}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Purchase Date</p>
            <p>{format(new Date(data.purchase_date), 'dd/MM/yyyy')}</p>
          </div>
        </div>
      </div>

      {/* ── Items table ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
        <div className="px-5 py-3 border-b bg-muted/40 flex items-center justify-between">
          <p className="text-sm font-semibold">Line Items</p>
          <p className="text-xs text-muted-foreground">{data.items.length} item{data.items.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="px-3 py-2.5 text-left w-6">#</th>
                <th className="px-3 py-2.5 text-left">Medicine</th>
                <th className="px-3 py-2.5 text-left w-24">Batch No</th>
                <th className="px-3 py-2.5 text-left w-24">Expiry</th>
                <th className="px-3 py-2.5 text-center w-14">Pack</th>
                <th className="px-3 py-2.5 text-center w-14">Qty</th>
                <th className="px-3 py-2.5 text-center w-14">Free</th>
                <th className="px-3 py-2.5 text-center w-16">Total</th>
                <th className="px-3 py-2.5 text-right w-24">P.Price</th>
                <th className="px-3 py-2.5 text-right w-24">S.Price</th>
                <th className="px-3 py-2.5 text-right w-20">Disc</th>
                <th className="px-3 py-2.5 text-right w-16">Tax%</th>
                <th className="px-3 py-2.5 text-right w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => {
                // Format expiry: YYYY-MM → MM/YYYY
                const expDisplay = item.expiry_date.length === 7
                  ? item.expiry_date.split('-').reverse().join('/')
                  : item.expiry_date

                return (
                  <tr
                    key={i}
                    className={cn(
                      'border-b last:border-b-0',
                      i % 2 === 1 ? 'bg-muted/20' : '',
                    )}
                  >
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium">{medicineMap.get(item.medicine_id) ?? item.medicine_id}</td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground text-xs">{item.batch_no}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{expDisplay}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{item.packing_qty}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums font-medium">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-emerald-600 dark:text-emerald-400">
                      {item.free_qty > 0 ? `+${item.free_qty}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums font-semibold">{item.total_qty}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatINR(item.purchase_price)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatINR(item.sale_price)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {item.discount_value > 0
                        ? `${item.discount_type === 'percent' ? `${item.discount_value}%` : formatINR(item.discount_value)}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {item.tax > 0 ? `${item.tax}%` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-green-700 dark:text-green-400">
                      {formatINR(item.price)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Totals footer */}
        <div className="border-t bg-muted/30 px-5 py-4">
          <div className="flex justify-end">
            <div className="space-y-1.5 text-sm text-right min-w-[240px]">
              <div className="flex justify-between gap-8">
                <span className="text-muted-foreground">Sub Total</span>
                <span className="tabular-nums font-medium">{formatINR(data.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-8">
                <span className="text-muted-foreground">Discount</span>
                <span className="tabular-nums">{formatINR(data.discount_total)}</span>
              </div>
              <div className="flex justify-between gap-8">
                <span className="text-muted-foreground">Tax</span>
                <span className="tabular-nums">{formatINR(data.tax_total)}</span>
              </div>
              <div className="flex justify-between gap-8 pt-2 border-t font-semibold text-base">
                <span>Grand Total</span>
                <span className="tabular-nums text-green-700 dark:text-green-400">{formatINR(data.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Action buttons ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto px-8"
          onClick={onEdit}
          disabled={saving}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Edit
        </Button>
        <Button
          type="button"
          className="w-full sm:w-auto px-12 bg-green-600 hover:bg-green-700 text-white"
          onClick={onConfirm}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-1.5" />
              Confirm &amp; Save
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ── Defaults ──────────────────────────────────────────────────────────────────

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

// ── Main form component ───────────────────────────────────────────────────────

export function PurchaseForm({ suppliers, medicines, initialData }: PurchaseFormProps) {
  const isEdit = !!initialData

  const [lastSalePrices, setLastSalePrices] = useState<Record<string, number>>({})
  const [loadingPrices, setLoadingPrices]   = useState(false)

  // Preview mode state
  const [mode, setMode]           = useState<'form' | 'preview'>('form')
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [saving, setSaving]       = useState(false)

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
            return { ...item, item_subtotal: line.subtotal, item_discount: line.discount, item_tax: line.tax_amount }
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

  const fetchLastSalePrices = React.useCallback(async (supplierId: string) => {
    if (!supplierId) { setLastSalePrices({}); return }
    setLoadingPrices(true)
    const result = await getLastSalePricesBySupplierAction(supplierId)
    setLastSalePrices(result.data)
    setLoadingPrices(false)
  }, [])

  React.useEffect(() => {
    if (initialData?.supplier_id) fetchLastSalePrices(initialData.supplier_id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Totals ──────────────────────────────────────────────────────────────────
  const subtotal      = watchedItems.reduce((s, i) => s + (i.item_subtotal || 0), 0)
  const discountTotal = watchedItems.reduce((s, i) => s + (i.item_discount || 0), 0)
  const taxTotal      = watchedItems.reduce((s, i) => s + (i.item_tax      || 0), 0)
  const grandTotal    = watchedItems.reduce((s, i) => s + (i.price         || 0), 0)

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
    form.setValue(`items.${index}.total_qty`,     totalQty,        { shouldDirty: true })
    form.setValue(`items.${index}.price`,         line.price,      { shouldDirty: true })
    form.setValue(`items.${index}.item_subtotal`, line.subtotal,   { shouldDirty: true })
    form.setValue(`items.${index}.item_discount`, line.discount,   { shouldDirty: true })
    form.setValue(`items.${index}.item_tax`,      line.tax_amount, { shouldDirty: true })
  }

  // ── Step 1: validate → show preview ────────────────────────────────────────
  function handlePreview(values: FormValues) {
    const s  = values.items.reduce((a, i) => a + (i.item_subtotal || 0), 0)
    const d  = values.items.reduce((a, i) => a + (i.item_discount || 0), 0)
    const t  = values.items.reduce((a, i) => a + (i.item_tax      || 0), 0)
    const g  = values.items.reduce((a, i) => a + (i.price         || 0), 0)
    setPreviewData({
      supplier_id:    values.supplier_id,
      invoice_no:     values.invoice_no,
      purchase_date:  values.purchase_date,
      items:          values.items,
      subtotal:       s,
      discount_total: d,
      tax_total:      t,
      total:          g,
    })
    setMode('preview')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Step 2: confirm → actually save ────────────────────────────────────────
  async function handleConfirmSave() {
    if (!previewData) return
    setSaving(true)
    const payload = {
      supplier_id:   previewData.supplier_id,
      invoice_no:    previewData.invoice_no,
      purchase_date: previewData.purchase_date,
      items:         previewData.items as PurchaseItemInput[],
      subtotal:      previewData.subtotal,
      discount:      previewData.discount_total,
      tax:           previewData.tax_total,
      total:         previewData.total,
    }
    const result = isEdit
      ? await updatePurchaseAction(initialData.id, payload)
      : await createPurchaseAction(payload)
    if (result?.error) {
      toast.error(result.error)
      setSaving(false)
    }
    // On success, createPurchaseAction/updatePurchaseAction redirect() — no need to setSaving(false)
  }

  const supplierName =
    suppliers.find((s) => s.id === previewData?.supplier_id)?.name ?? '—'

  // ── Preview mode ────────────────────────────────────────────────────────────
  if (mode === 'preview' && previewData) {
    return (
      <PurchasePreview
        data={previewData}
        supplierName={supplierName}
        medicines={medicines}
        onEdit={() => setMode('form')}
        onConfirm={handleConfirmSave}
        saving={saving}
      />
    )
  }

  // ── Form mode ───────────────────────────────────────────────────────────────
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handlePreview)} className="space-y-6">

        {/* Purchase Header */}
        <Card>
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              {/* Supplier */}
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

              {/* Invoice Number */}
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

              {/* Purchase Date */}
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

        {/* ── Purchase Items — single-row table ───────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Purchase Items ({fields.length})
            </h3>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/60 border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    <th className="px-2 py-2 text-center w-8">#</th>
                    <th className="px-2 py-2 text-left" style={{ minWidth: 180 }}>Medicine</th>
                    <th className="px-2 py-2 text-left" style={{ width: 96 }}>Batch No</th>
                    <th className="px-2 py-2 text-left" style={{ width: 118 }}>Expiry</th>
                    <th className="px-2 py-2 text-center" style={{ width: 56 }}>Pack</th>
                    <th className="px-2 py-2 text-center" style={{ width: 56 }}>Qty</th>
                    <th className="px-2 py-2 text-center" style={{ width: 56 }}>Free</th>
                    <th className="px-2 py-2 text-center" style={{ width: 60 }}>Total</th>
                    <th className="px-2 py-2 text-right" style={{ width: 88 }}>P.Price</th>
                    <th className="px-2 py-2 text-right" style={{ width: 88 }}>S.Price</th>
                    <th className="px-2 py-2 text-left" style={{ width: 128 }}>Discount</th>
                    <th className="px-2 py-2 text-center" style={{ width: 64 }}>Tax %</th>
                    <th className="px-2 py-2 text-right" style={{ width: 90 }}>Amount</th>
                    <th className="px-2 py-2 w-9"></th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => (
                    <tr key={field.id} className="border-b last:border-b-0 hover:bg-muted/20 align-top">

                      {/* # */}
                      <td className="px-2 py-2 text-center">
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-green-600 text-white text-[10px] font-bold">
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
                                  // Auto-fill sale price from last purchase of this medicine with the selected supplier
                                  const prevPrice = lastSalePrices[id]
                                  if (prevPrice && prevPrice > 0) {
                                    form.setValue(`items.${index}.sale_price`, prevPrice, { shouldDirty: true })
                                  }
                                  recalcItem(index)
                                }}
                              />
                            </FormControl>
                            <FormMessage className="text-[10px] mt-0.5" />
                          </FormItem>
                        )} />
                      </td>

                      {/* Batch No */}
                      <td className="px-2 py-2">
                        <FormField control={form.control} name={`items.${index}.batch_no`} render={({ field }) => (
                          <FormItem className="space-y-0">
                            <FormControl>
                              <Input className="h-8 text-sm px-2" placeholder="BN001" {...field} />
                            </FormControl>
                            <FormMessage className="text-[10px] mt-0.5" />
                          </FormItem>
                        )} />
                      </td>

                      {/* Expiry */}
                      <td className="px-2 py-2">
                        <FormField control={form.control} name={`items.${index}.expiry_date`} render={({ field }) => (
                          <FormItem className="space-y-0">
                            <FormControl>
                              <Input className="h-8 text-sm px-2" type="month" {...field} />
                            </FormControl>
                            <FormMessage className="text-[10px] mt-0.5" />
                          </FormItem>
                        )} />
                      </td>

                      {/* Pack */}
                      <td className="px-2 py-2">
                        <FormField control={form.control} name={`items.${index}.packing_qty`} render={({ field }) => (
                          <FormItem className="space-y-0">
                            <FormControl>
                              <Input
                                className="h-8 text-sm text-center no-spinner px-1"
                                type="number" min="1"
                                {...field}
                                onChange={e => { field.onChange(e); recalcItem(index) }}
                              />
                            </FormControl>
                          </FormItem>
                        )} />
                      </td>

                      {/* Qty */}
                      <td className="px-2 py-2">
                        <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                          <FormItem className="space-y-0">
                            <FormControl>
                              <Input
                                className="h-8 text-sm text-center no-spinner px-1"
                                type="number" min="1"
                                {...field}
                                onChange={e => { field.onChange(e); recalcItem(index) }}
                              />
                            </FormControl>
                            <FormMessage className="text-[10px] mt-0.5" />
                          </FormItem>
                        )} />
                      </td>

                      {/* Free */}
                      <td className="px-2 py-2">
                        <FormField control={form.control} name={`items.${index}.free_qty`} render={({ field }) => (
                          <FormItem className="space-y-0">
                            <FormControl>
                              <Input
                                className="h-8 text-sm text-center no-spinner px-1"
                                type="number" min="0"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )} />
                      </td>

                      {/* Total Qty — read-only */}
                      <td className="px-2 py-2">
                        <div className="h-8 flex items-center justify-center rounded-md bg-muted border text-sm tabular-nums font-semibold">
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
                                className="h-8 text-sm text-right no-spinner px-2"
                                type="number" step="0.01" min="0"
                                {...field}
                                onChange={e => { field.onChange(e); recalcItem(index) }}
                              />
                            </FormControl>
                            <FormMessage className="text-[10px] mt-0.5" />
                          </FormItem>
                        )} />
                      </td>

                      {/* Sale Price */}
                      <td className="px-2 py-2">
                        <FormField control={form.control} name={`items.${index}.sale_price`} render={({ field }) => {
                          const medicineId  = watchedItems[index]?.medicine_id
                          const suggested   = medicineId ? lastSalePrices[medicineId] : undefined
                          const current     = Number(field.value) || 0
                          const showSuggest = suggested && suggested > 0 && current !== suggested
                          return (
                            <FormItem className="space-y-0">
                              <FormControl>
                                <Input
                                  className="h-8 text-sm text-right no-spinner px-2"
                                  type="number" step="0.01" min="0"
                                  {...field}
                                />
                              </FormControl>
                              {loadingPrices && medicineId && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                </span>
                              )}
                              {showSuggest && (
                                <button
                                  type="button"
                                  className="block text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap mt-0.5"
                                  onClick={() => field.onChange(suggested)}
                                >
                                  Prev: ₹{suggested}
                                </button>
                              )}
                            </FormItem>
                          )
                        }} />
                      </td>

                      {/* Discount */}
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <FormField control={form.control} name={`items.${index}.discount_type`} render={({ field }) => (
                            <FormItem className="space-y-0 shrink-0">
                              <Select value={field.value} onValueChange={v => { field.onChange(v); recalcItem(index) }}>
                                <FormControl>
                                  <SelectTrigger className="w-12 h-8 px-1.5 text-sm">
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
                            <FormItem className="space-y-0 flex-1 min-w-0">
                              <FormControl>
                                <Input
                                  className="h-8 text-sm text-right no-spinner px-2"
                                  type="number" step="0.01" min="0" placeholder="0"
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
                                className="h-8 text-sm text-center no-spinner px-1"
                                type="number" step="0.01" min="0" placeholder="0"
                                {...field}
                                onChange={e => { field.onChange(e); recalcItem(index) }}
                              />
                            </FormControl>
                          </FormItem>
                        )} />
                      </td>

                      {/* Amount — read-only */}
                      <td className="px-2 py-2">
                        <div className="h-8 flex items-center justify-end px-2 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-sm tabular-nums font-semibold text-green-700 dark:text-green-400 whitespace-nowrap">
                          {formatINR(watchedItems[index]?.price || 0)}
                        </div>
                      </td>

                      {/* Delete */}
                      <td className="px-1 py-2 text-center">
                        <Button
                          type="button" size="icon" variant="ghost"
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

          <Button
            type="button"
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            onClick={() => append(defaultItem)}
          >
            <Plus className="w-4 h-4 mr-1.5" />Add Item
          </Button>
        </div>

        {/* Summary */}
        <div className="flex justify-end">
          <div className="w-72 rounded-lg border overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr className="border-b">
                  <td className="py-2.5 px-4 text-muted-foreground border-r">Sub Total</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">{subtotal.toFixed(2)}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2.5 px-4 text-muted-foreground border-r">Discount</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">{discountTotal.toFixed(2)}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2.5 px-4 text-muted-foreground border-r">Tax</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">{taxTotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-semibold text-base border-r">Amount</td>
                  <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-base">{grandTotal.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Preview & Save button */}
        <div className="flex justify-center pt-2">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full sm:w-auto px-12 bg-green-600 hover:bg-green-700 text-white"
          >
            {form.formState.isSubmitting ? 'Validating…' : isEdit ? 'Preview & Update' : 'Preview & Save'}
          </Button>
        </div>

      </form>
    </Form>
  )
}
