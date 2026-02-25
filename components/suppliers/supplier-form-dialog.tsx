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
import { createSupplierAction, updateSupplierAction } from '@/app/(dashboard)/suppliers/actions'
import type { Supplier } from '@/lib/types/database'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function SupplierForm({
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Supplier Name *</FormLabel>
              <FormControl><Input placeholder="ABC Pharma Distributors" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="contact_person" render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Person</FormLabel>
              <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl><Input placeholder="+91 9876543210" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Email</FormLabel>
              <FormControl><Input type="email" placeholder="supplier@email.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="address" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Address</FormLabel>
              <FormControl><Input placeholder="Street address" {...field} /></FormControl>
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

export function SupplierFormDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(values: FormValues) {
    setLoading(true)
    const fd = new FormData()
    Object.entries(values).forEach(([k, v]) => v && fd.append(k, v))
    const result = await createSupplierAction(fd)
    setLoading(false)
    if (result?.error) toast.error(result.error)
    else { toast.success('Supplier added'); setOpen(false) }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-4 h-4 mr-2" />Add Supplier</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add Supplier</DialogTitle></DialogHeader>
        <SupplierForm
          defaultValues={{ name: '', contact_person: '', phone: '', email: '', address: '', city: '', pincode: '' }}
          onSubmit={onSubmit}
          loading={loading}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

export function SupplierEditDialog({ supplier }: { supplier: Supplier }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(values: FormValues) {
    setLoading(true)
    const fd = new FormData()
    Object.entries(values).forEach(([k, v]) => v && fd.append(k, v))
    const result = await updateSupplierAction(supplier.id, fd)
    setLoading(false)
    if (result?.error) toast.error(result.error)
    else { toast.success('Supplier updated'); setOpen(false) }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit Supplier</DialogTitle></DialogHeader>
        <SupplierForm
          defaultValues={{
            name: supplier.name,
            contact_person: supplier.contact_person ?? '',
            phone: supplier.phone ?? '',
            email: supplier.email ?? '',
            address: supplier.address ?? '',
            city: supplier.city ?? '',
            pincode: supplier.pincode ?? '',
          }}
          onSubmit={onSubmit}
          loading={loading}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
