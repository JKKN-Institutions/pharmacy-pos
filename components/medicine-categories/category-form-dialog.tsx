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
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  createCategoryAction,
  updateCategoryAction,
} from '@/app/(dashboard)/medicine-categories/actions'
import type { MedicineCategory } from '@/lib/types/database'

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name:        z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
  is_active:   z.boolean(),
})
type FormValues = z.infer<typeof schema>

// ── Add dialog ────────────────────────────────────────────────────────────────

export function CategoryFormDialog() {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', is_active: true },
  })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    const result = await createCategoryAction(values)
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
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Category</DialogTitle>
        </DialogHeader>
        <CategoryFormFields form={form} onSubmit={onSubmit} loading={loading} onCancel={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

// ── Edit dialog ───────────────────────────────────────────────────────────────

export function CategoryEditDialog({ category }: { category: MedicineCategory }) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:        category.name,
      description: category.description ?? '',
      is_active:   category.is_active,
    },
  })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    const result = await updateCategoryAction(category.id, values)
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
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
        </DialogHeader>
        <CategoryFormFields form={form} onSubmit={onSubmit} loading={loading} onCancel={() => setOpen(false)} isEdit />
      </DialogContent>
    </Dialog>
  )
}

// ── Shared form fields ────────────────────────────────────────────────────────

function CategoryFormFields({
  form,
  onSubmit,
  loading,
  onCancel,
  isEdit = false,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any
  onSubmit: (v: FormValues) => void
  loading: boolean
  onCancel: () => void
  isEdit?: boolean
}) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        {/* Name */}
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Category Name <span className="text-destructive">*</span></FormLabel>
            <FormControl>
              <Input placeholder="e.g. Antibiotic" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Description */}
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Optional description..."
                className="resize-none h-20"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Status toggle */}
        <FormField control={form.control} name="is_active" render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <FormLabel className="text-sm font-medium">Active</FormLabel>
              <p className="text-xs text-muted-foreground">Inactive categories won&apos;t appear in dropdowns</p>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )} />

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update' : 'Save'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
