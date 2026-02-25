'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
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
import { createPurchaseAction } from '@/app/(dashboard)/purchases/actions'
import { calculateLineItem, calculateBillTotals } from '@/lib/utils/billing'
import { formatINR } from '@/lib/utils/currency'
import { useMemo } from 'react'

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
  price: z.coerce.number().min(0),
})

const schema = z.object({
  supplier_id: z.string().min(1, 'Supplier is required'),
  invoice_no: z.string().min(1, 'Invoice no. required'),
  purchase_date: z.string().min(1, 'Date required'),
  items: z.array(itemSchema).min(1, 'Add at least one item'),
})

type FormValues = z.infer<typeof schema>

interface PurchaseFormProps {
  suppliers: { id: string; name: string }[]
  medicines: { id: string; name: string; company: string | null; unit: string | null }[]
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

  const totals = useMemo(() => {
    const lineItems = watchedItems.map(item =>
      calculateLineItem({
        qty: item.total_qty || 0,
        unit_price: item.purchase_price || 0,
        discount_type: item.discount_type,
        discount_value: item.discount_value || 0,
        tax: item.tax || 0,
      })
    )
    return calculateBillTotals(lineItems)
  }, [watchedItems])

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

  function updateTotalQty(index: number) {
    const item = form.getValues(`items.${index}`)
    const totalQty = (item.packing_qty || 1) * (item.quantity || 0)
    form.setValue(`items.${index}.total_qty`, totalQty)
    const line = calculateLineItem({
      qty: totalQty,
      unit_price: item.purchase_price || 0,
      discount_type: item.discount_type,
      discount_value: item.discount_value || 0,
      tax: item.tax || 0,
    })
    form.setValue(`items.${index}.price`, line.price)
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
                  <SelectContent>
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
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <FormField control={form.control} name={`items.${index}.medicine_id`} render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Medicine</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select medicine" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {medicines.map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                  <FormField control={form.control} name={`items.${index}.packing_qty`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pack Qty</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} onChange={e => { field.onChange(e); updateTotalQty(index) }} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qty</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} onChange={e => { field.onChange(e); updateTotalQty(index) }} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${index}.purchase_price`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase ₹</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} onChange={e => { field.onChange(e); updateTotalQty(index) }} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${index}.sale_price`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sale ₹</FormLabel>
                      <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${index}.tax`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax %</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} onChange={e => { field.onChange(e); updateTotalQty(index) }} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <div className="flex items-end">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">Total</p>
                      <p className="font-semibold text-sm">{formatINR(watchedItems[index]?.price || 0)}</p>
                    </div>
                    {fields.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Totals */}
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
