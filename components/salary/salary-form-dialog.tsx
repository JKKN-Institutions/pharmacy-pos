'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createSalaryAction } from '@/app/(dashboard)/salary/actions'

const schema = z.object({
  staff_name: z.string().min(1),
  amount: z.coerce.number().min(0.01),
  method: z.enum(['cash', 'upi', 'card', 'credit']),
  date: z.string().min(1),
  note: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function SalaryFormDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      staff_name: '',
      amount: 0,
      method: 'cash',
      date: new Date().toISOString().split('T')[0],
      note: '',
    },
  })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    const fd = new FormData()
    Object.entries(values).forEach(([k, v]) => v !== undefined && fd.append(k, String(v)))
    const result = await createSalaryAction(fd)
    setLoading(false)
    if (result?.error) toast.error(result.error)
    else { toast.success('Salary record added'); form.reset(); setOpen(false) }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-2" />Add Record</Button></DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add Salary Record</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="staff_name" render={({ field }) => (
              <FormItem><FormLabel>Staff Name *</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem><FormLabel>Amount ₹ *</FormLabel><FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="method" render={({ field }) => (
              <FormItem>
                <FormLabel>Method</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem><FormLabel>Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="note" render={({ field }) => (
              <FormItem><FormLabel>Note</FormLabel><FormControl><Input placeholder="Optional note" {...field} /></FormControl></FormItem>
            )} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}