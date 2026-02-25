'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { createCustomerAction, updateCustomerAction } from '@/app/(dashboard)/customers/actions'
import type { Customer } from '@/lib/types/database'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const schema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().min(1, 'Phone is required'),
  blood_group: z.string().optional(),
  dob: z.string().optional(),
  gender: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function CustomerForm({
  defaultValues,
  onSubmit,
  loading,
  onCancel,
}: {
  defaultValues: FormValues
  onSubmit: (values: FormValues) => void
  loading: boolean
  onCancel: () => void
}) {
  const form = useForm<FormValues>({ // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any, defaultValues })
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="first_name" render={({ field }) => (
            <FormItem>
              <FormLabel>First Name *</FormLabel>
              <FormControl><Input placeholder="Rajesh" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="last_name" render={({ field }) => (
            <FormItem>
              <FormLabel>Last Name</FormLabel>
              <FormControl><Input placeholder="Kumar" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel>Mobile *</FormLabel>
              <FormControl><Input placeholder="+91 9876543210" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input type="email" placeholder="patient@email.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="dob" render={({ field }) => (
            <FormItem>
              <FormLabel>Date of Birth</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="gender" render={({ field }) => (
            <FormItem>
              <FormLabel>Gender</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="blood_group" render={({ field }) => (
            <FormItem>
              <FormLabel>Blood Group</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {BLOOD_GROUPS.map(bg => (
                    <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="city" render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl><Input placeholder="Chennai" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="address_line1" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Address Line 1</FormLabel>
              <FormControl><Input placeholder="Street / Door No." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="address_line2" render={({ field }) => (
            <FormItem>
              <FormLabel>Address Line 2</FormLabel>
              <FormControl><Input placeholder="Area / Landmark" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="pincode" render={({ field }) => (
            <FormItem>
              <FormLabel>Pincode</FormLabel>
              <FormControl><Input placeholder="600001" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
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

const emptyValues: FormValues = {
  first_name: '', last_name: '', email: '', phone: '',
  blood_group: '', dob: '', gender: '',
  address_line1: '', address_line2: '', city: '', pincode: '',
}

export function CustomerFormDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(values: FormValues) {
    setLoading(true)
    const fd = new FormData()
    Object.entries(values).forEach(([k, v]) => v && fd.append(k, v))
    const result = await createCustomerAction(fd)
    setLoading(false)
    if (result?.error) toast.error(result.error)
    else { toast.success('Customer added'); setOpen(false) }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-4 h-4 mr-2" />Add Customer</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
        <CustomerForm defaultValues={emptyValues} onSubmit={onSubmit} loading={loading} onCancel={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

export function CustomerEditDialog({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(values: FormValues) {
    setLoading(true)
    const fd = new FormData()
    Object.entries(values).forEach(([k, v]) => v && fd.append(k, v))
    const result = await updateCustomerAction(customer.id, fd)
    setLoading(false)
    if (result?.error) toast.error(result.error)
    else { toast.success('Customer updated'); setOpen(false) }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
        <CustomerForm
          defaultValues={{
            first_name: customer.first_name ?? '',
            last_name: customer.last_name ?? '',
            email: customer.email ?? '',
            phone: customer.phone,
            blood_group: customer.blood_group ?? '',
            dob: customer.dob ?? '',
            gender: customer.gender ?? '',
            address_line1: customer.address_line1 ?? '',
            address_line2: customer.address_line2 ?? '',
            city: customer.city ?? '',
            pincode: customer.pincode ?? '',
          }}
          onSubmit={onSubmit}
          loading={loading}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
