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
import { createCategoryAction, updateCategoryAction } from '@/app/(dashboard)/medicine-categories/actions'
import type { MedicineCategory } from '@/lib/types/database'

const schema = z.object({ name: z.string().min(1, 'Name is required') })
type FormValues = z.infer<typeof schema>

export function CategoryFormDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const form = useForm<FormValues>({ // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any, defaultValues: { name: '' } })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    const result = await createCategoryAction(values.name)
    setLoading(false)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success('Category created')
      form.reset()
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-4 h-4 mr-2" />Add Category</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Category Name</FormLabel>
                <FormControl><Input placeholder="e.g. Tablet" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
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

export function CategoryEditDialog({ category }: { category: MedicineCategory }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: category.name } })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    const result = await updateCategoryAction(category.id, values.name)
    setLoading(false)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success('Category updated')
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Edit Category</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Category Name</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={loading}>{loading ? 'Saving...' : 'Update'}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
