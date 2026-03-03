'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createInvoiceAction } from '@/app/(dashboard)/invoices/actions'
import { calculateLineItem, calculateBillTotals } from '@/lib/utils/billing'
import { formatINR } from '@/lib/utils/currency'
import { useMemo } from 'react'
import type { Customer } from '@/lib/types/database'

const itemSchema = z.object({
  item_name: z.string().min(1, 'Item name required'),
  item_description: z.string().optional(),
  qty: z.coerce.number().min(1),
  unit_cost: z.coerce.number().min(0),
  discount_type: z.enum(['percent', 'flat']).default('percent'),
  discount_value: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
  price: z.coerce.number().min(0).default(0),
})

const schema = z.object({
  customer_id: z.string().optional(),
  payment_method: z.enum(['cash', 'upi', 'card', 'credit']).default('credit'),
  payment_status: z.enum(['paid', 'partial', 'unpaid']).default('unpaid'),
  invoice_status: z.enum(['draft', 'sent', 'paid']).default('draft'),
  invoice_date: z.string().min(1),
  due_date: z.string().optional(),
  customer_note: z.string().optional(),
  terms_conditions: z.string().optional(),
  items: z.array(itemSchema).min(1),
})

type FormValues = z.infer<typeof schema>

const defaultItem = { item_name: '', item_description: '', qty: 1, unit_cost: 0, discount_type: 'percent' as const, discount_value: 0, tax: 0, price: 0 }

export function InvoiceForm({ customers }: { customers: Pick<Customer, 'id' | 'first_name' | 'last_name' | 'phone'>[] }) {
  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      customer_id: '',
      payment_method: 'credit',
      payment_status: 'unpaid',
      invoice_status: 'draft',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: '',
      items: [defaultItem],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })
  const watchedItems = form.watch('items')

  const lineItems = useMemo(() =>
    watchedItems.map(item =>
      calculateLineItem({ qty: item.qty || 0, unit_price: item.unit_cost || 0, discount_type: item.discount_type, discount_value: item.discount_value || 0, tax: item.tax || 0 })
    ), [watchedItems])

  const totals = useMemo(() => calculateBillTotals(lineItems), [lineItems])

  async function onSubmit(values: FormValues) {
    const result = await createInvoiceAction({
      invoice: {
        customer_id: values.customer_id || undefined,
        payment_method: values.payment_method,
        payment_status: values.payment_status,
        invoice_status: values.invoice_status,
        invoice_date: values.invoice_date,
        due_date: values.due_date || undefined,
        customer_note: values.customer_note,
        terms_conditions: values.terms_conditions,
      },
      items: values.items.map((item) => {
        const line = calculateLineItem({ qty: item.qty, unit_price: item.unit_cost, discount_type: item.discount_type, discount_value: item.discount_value, tax: item.tax })
        return { ...item, price: line.price }
      }),
      ...totals,
      paid: values.payment_status === 'paid' ? totals.total : 0,
      due: values.payment_status === 'paid' ? 0 : totals.total,
    })
    if (result?.error) toast.error(result.error)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Invoice Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField control={form.control} name="customer_id" render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Customer</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select customer (optional)" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name ?? ''} · {c.phone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="invoice_date" render={({ field }) => (
              <FormItem><FormLabel>Invoice Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="due_date" render={({ field }) => (
              <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="payment_method" render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Method</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="credit">Credit</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="payment_status" render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="invoice_status" render={({ field }) => (
              <FormItem>
                <FormLabel>Invoice Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Line Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => append(defaultItem)}>
              <Plus className="w-4 h-4 mr-1" />Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-2 gap-2 items-start p-3 border rounded-lg bg-muted/20 sm:grid-cols-12">
                <div className="col-span-2 sm:col-span-4">
                  <FormField control={form.control} name={`items.${index}.item_name`} render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Item Name *</FormLabel><FormControl><Input placeholder="Medicine/Service name" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <FormField control={form.control} name={`items.${index}.qty`} render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Qty</FormLabel><FormControl><Input type="number" min="1" {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <FormField control={form.control} name={`items.${index}.unit_cost`} render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Unit Rate &#8377;</FormLabel><FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <FormField control={form.control} name={`items.${index}.discount_value`} render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Discount %</FormLabel><FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <div className="col-span-1 sm:col-span-1 flex items-end h-full pb-0.5">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total</p>
                    <p className="text-sm font-semibold">{formatINR(lineItems[index]?.price ?? 0)}</p>
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1 flex items-end justify-end h-full pb-0.5">
                  {fields.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end px-2">
          <div className="space-y-1 text-sm w-full sm:w-64">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(totals.subtotal)}</span></div>
            <div className="flex justify-between text-green-600"><span>Discount</span><span>- {formatINR(totals.discount_total)}</span></div>
            <div className="flex justify-between border-t pt-1 font-bold text-base"><span>Total</span><span>{formatINR(totals.total)}</span></div>
          </div>
        </div>

        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
          {form.formState.isSubmitting ? 'Creating...' : 'Create Invoice'}
        </Button>
      </form>
    </Form>
  )
}
