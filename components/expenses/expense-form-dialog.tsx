'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createExpenseAction, updateExpenseAction } from '@/app/(dashboard)/expenses/actions'
import type { Expense } from '@/lib/types/database'

const EXPENSE_TYPES = ['Rent', 'Electricity', 'Salary', 'Maintenance', 'Transport', 'Stock Write-off', 'Marketing', 'Other']

const schema = z.object({
  name: z.string().min(1),
  expense_type: z.string().min(1),
  amount: z.coerce.number().min(0.01),
  method: z.enum(['cash', 'upi', 'card', 'credit']),
  date: z.string().min(1),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function ExpenseFormContent({ defaultValues, onSubmit, loading, onCancel }: {
  defaultValues: FormValues
  onSubmit: (v: FormValues) => void
  loading: boolean
  onCancel: () => void
}) {
  const form = useForm<FormValues>({ // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any, defaultValues })
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem className="col-span-2"><FormLabel>Expense Name *</FormLabel><FormControl><Input placeholder="e.g. Monthly Rent" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="expense_type" render={({ field }) => (
            <FormItem>
              <FormLabel>Type *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                <SelectContent>{EXPENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="amount" render={({ field }) => (
            <FormItem><FormLabel>Amount â¹ *</FormLabel><FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="method" render={({ field }) => (
            <FormItem>
              <FormLabel>Payment Method</FormLabel>
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
          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem className="col-span-2"><FormLabel>Description</FormLabel><FormControl><Input placeholder="Optional notes" {...field} /></FormControl></FormItem>
          )} />
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
        </div>
      </form>
    </Form>
  )
}

const defaultValues: FormValues = { name: '', expense_type: '', amount: 0, method: 'cash', date: new Date().toISOString().split('T')[0], description: '' }

export function ExpenseFormDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  async function onSubmit(values: FormValues) {
    setLoading(true)
    const fd = new FormData()
    Object.entries(values).forEach(([k, v]) => v !== undefined && fd.append(k, String(v)))
    const result = await createExpenseAction(fd)
    setLoading(false)
    if (result?.error) toast.error(result.error)
    else { toast.success('Expense added'); setOpen(false) }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-2" />Add Expense</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
        <ExpenseFormContent defaultValues={defaultValues} onSubmit={onSubmit} loading={loading} onCancel={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

export function ExpenseEditDialog({ expense }: { expense: Expense }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  async function onSubmit(values: FormValues) {
    setLoading(true)
    const fd = new FormData()
    Object.entries(values).forEach(([k, v]) => v !== undefined && fd.append(k, String(v)))
    const result = await updateExpenseAction(expense.id, fd)
    setLoading(false)
    if (result?.error) toast.error(result.error)
    else { toast.success('Expense updated'); setOpen(false) }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Expense</DialogTitle></DialogHeader>
        <ExpenseFormContent
          defaultValues={{ name: expense.name, expense_type: expense.expense_type, amount: expense.amount, method: (expense.method as 'cash' | 'upi' | 'card' | 'credit') ?? 'cash', date: expense.date, description: expense.description ?? '' }}
          onSubmit={onSubmit} loading={loading} onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}