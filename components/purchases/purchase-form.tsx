'use client'

import * as React from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Trash2, Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { createPurchaseAction } from '@/app/(dashboard)/purchases/actions'
import { calculateLineItem } from '@/lib/utils/billing'
import { formatINR } from '@/lib/utils/currency'

const itemSchema = z.object({
  medicine_id: z.string().min(1, 'Select a medicine'),
  batch_no: z.string().min(1, 'Batch no. required'),
  expiry_date: z.string().min(1, 'Expiry date required'),
  packing_qty: z.coerce.number().min(1).default(1),
  quantity: z.coerce.number().min(1, 'Qty required'),
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

type MedicineOption = { id: string; name: string; company: string | null; unit: string | null }

interface PurchaseFormProps {
  suppliers: { id: string; name: string }[]
  medicines: MedicineOption[]
}

// Searchable combobox for medicine selection — Select is unusable at 2000+ items
function MedicineCombobox({
  medicines,
  value,
  onValueChange,
}: {
  medicines: MedicineOption[]
  value: string
  onValueChange: (id: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const selected = medicines.find((m) => m.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
        <Command>
          <CommandInput placeholder="Type to search medicine…" />
          <CommandList>
            <CommandEmpty>No medicine found.</CommandEmpty>
            <CommandGroup>
              {medicines.map((m) => (
                <CommandItem
                  key={m.id}
                  value={m.name}
                  onSelect={() => {
                    onValueChange(m.id)
                    setOpen(false)
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

export function PurchaseForm({ suppliers, medicines }: PurchaseFormProps) {
  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      supplier_id: '',
      invoice_no: '',
      purchase_date: new Date().toISOString().split('T')[0],
      items: [defaultItem],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })
  const watchedItems = form.watch('items')

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
    const result = await createPurchaseAction({
      ...values,
      subtotal: totals.subtotal,
      discount: totals.discount_total,
      tax: totals.tax_total,
      total: totals.total,
    })
    if (result?.error) toast.error(result.error)
  }

  // Recalculates ALL derived fields for one item using form.getValues() which
  // is always synchronous and reflects the just-typed value immediately.
  function recalcItem(index: number) {
    const item = form.getValues(`items.${index}`)
    const totalQty = (Number(item.packing_qty) || 1) * (Number(item.quantity) || 0)
    const line = calculateLineItem({
      qty: totalQty,
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
          <CardHeader><CardTitle className="text-base">Purchase Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField control={form.control} name="supplier_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  </FormControl>
                  <SelectContent position="popper">
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="invoice_no" render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier Invoice No. *</FormLabel>
                <FormControl><Input placeholder="INV-2024-001" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="purchase_date" render={({ field }) => (
              <FormItem>
                <FormLabel>Purchase Date *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => append(defaultItem)}>
              <Plus className="w-4 h-4 mr-1" />Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 border rounded-lg space-y-3 bg-muted/20">

                {/* Row 1: Medicine, Batch No, Expiry Date */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <FormField control={form.control} name={`items.${index}.medicine_id`} render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Medicine</FormLabel>
                      <FormControl>
                        <MedicineCombobox
                          medicines={medicines}
                          value={field.value}
                          onValueChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${index}.batch_no`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch No.</FormLabel>
                      <FormControl><Input placeholder="BN001" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${index}.expiry_date`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiry Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Row 2: Qty inputs + Price inputs + Row total */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  <FormField control={form.control} name={`items.${index}.packing_qty`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pack Qty</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field}
                          onChange={e => { field.onChange(e); recalcItem(index) }} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qty</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field}
                          onChange={e => { field.onChange(e); recalcItem(index) }} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${index}.purchase_price`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase ₹</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field}
                          onChange={e => { field.onChange(e); recalcItem(index) }} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${index}.sale_price`} render={({ field }) => {
                    const pp = Number(watchedItems[index]?.purchase_price) || 0
                    const sp = Number(watchedItems[index]?.sale_price) || 0
                    const margin = pp > 0 && sp > 0
                      ? (((sp - pp) / pp) * 100).toFixed(1)
                      : null
                    return (
                      <FormItem>
                        <FormLabel>Sale ₹</FormLabel>
                        <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                        {margin !== null && (
                          <p className={cn(
                            'text-xs leading-none',
                            sp >= pp ? 'text-green-600' : 'text-destructive',
                          )}>
                            {sp >= pp ? '+' : ''}{margin}% margin
                          </p>
                        )}
                      </FormItem>
                    )
                  }} />
                  <FormField control={form.control} name={`items.${index}.tax`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax %</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field}
                          onChange={e => { field.onChange(e); recalcItem(index) }} />
                      </FormControl>
                    </FormItem>
                  )} />

                  {/* Row total + remove button */}
                  <div className="flex items-end">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">Total</p>
                      <p className="font-semibold text-sm">
                        {formatINR(watchedItems[index]?.price || 0)}
                      </p>
                    </div>
                    {fields.length > 1 && (
                      <Button
                        type="button" variant="ghost" size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Row 3: Discount — type toggle + value input */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <FormField control={form.control} name={`items.${index}.discount_type`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Type</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={v => { field.onChange(v); recalcItem(index) }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="percent">% Percent</SelectItem>
                          <SelectItem value="flat">₹ Flat</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${index}.discount_value`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Discount {watchedItems[index]?.discount_type === 'flat' ? '₹' : '%'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0"
                          {...field}
                          onChange={e => { field.onChange(e); recalcItem(index) }}
                        />
                      </FormControl>
                      {(watchedItems[index]?.item_discount ?? 0) > 0 && (
                        <p className="text-xs text-green-600 leading-none">
                          − {formatINR(watchedItems[index]?.item_discount ?? 0)} off
                        </p>
                      )}
                    </FormItem>
                  )} />
                </div>

              </div>
            ))}
          </CardContent>
        </Card>

        {/* Summary Totals */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col items-end gap-2 text-sm">
              <div className="flex gap-8">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="w-28 text-right">{formatINR(totals.subtotal)}</span>
              </div>
              <div className="flex gap-8">
                <span className="text-muted-foreground">Discount:</span>
                <span className="w-28 text-right text-green-600">- {formatINR(totals.discount_total)}</span>
              </div>
              <div className="flex gap-8">
                <span className="text-muted-foreground">Tax:</span>
                <span className="w-28 text-right">{formatINR(totals.tax_total)}</span>
              </div>
              <div className="flex gap-8 border-t pt-2 font-bold text-base">
                <span>Total:</span>
                <span className="w-28 text-right">{formatINR(totals.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
          {form.formState.isSubmitting ? 'Saving Purchase...' : 'Save Purchase'}
        </Button>

      </form>
    </Form>
  )
}
