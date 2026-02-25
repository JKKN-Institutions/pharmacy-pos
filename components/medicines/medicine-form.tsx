'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
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
import { createMedicineAction, updateMedicineAction } from '@/app/(dashboard)/medicines/actions'
import type { Medicine, MedicineCategory } from '@/lib/types/database'
const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  company: z.string().optional(),
  generic_name: z.string().optional(),
  category_id: z.string().optional(),
  unit: z.string().optional(),
  unit_packing: z.string().optional(),
  medicine_group: z.string().optional(),
  store_location: z.string().optional(),
  min_level: z.coerce.number().min(0).default(0),
  reorder_level: z.coerce.number().min(0).default(0),
  status: z.enum(['active', 'inactive']).default('active'),
})

type FormValues = z.infer<typeof schema>

interface MedicineFormProps {
  medicine?: Medicine
  categories: Pick<MedicineCategory, 'id' | 'name'>[]
}
export function MedicineForm({ medicine, categories }: MedicineFormProps) {
  const isEdit = !!medicine

  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: medicine?.name ?? '',
      company: medicine?.company ?? '',
      generic_name: medicine?.generic_name ?? '',
      category_id: medicine?.category_id ?? '',
      unit: medicine?.unit ?? '',
      unit_packing: medicine?.unit_packing ?? '',
      medicine_group: medicine?.medicine_group ?? '',
      store_location: medicine?.store_location ?? '',
      min_level: medicine?.min_level ?? 0,
      reorder_level: medicine?.reorder_level ?? 0,
      status: medicine?.status ?? 'active',
    },
  })

  async function onSubmit(values: FormValues) {
    const fd = new FormData()
    Object.entries(values).forEach(([k, v]) => {
      if (v !== undefined && v !== null) fd.append(k, String(v))
    })

    const result = isEdit
      ? await updateMedicineAction(medicine!.id, fd)
      : await createMedicineAction(fd)

    if (result?.error) {
      toast.error(result.error)
    }
    // On success, actions redirect to /medicines automatically
  }
  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Medicine Name *</FormLabel>
                  <FormControl><Input placeholder="e.g. Paracetamol 500mg" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="generic_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Generic Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Acetaminophen" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="company" render={({ field }) => (
                <FormItem>
                  <FormLabel>Company / Manufacturer</FormLabel>
                  <FormControl><Input placeholder="e.g. GSK" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="category_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent position="popper">
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="medicine_group" render={({ field }) => (
                <FormItem>
                  <FormLabel>Medicine Group</FormLabel>
                  <FormControl><Input placeholder="e.g. Analgesic" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="unit" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit</FormLabel>
                  <FormControl><Input placeholder="e.g. Tablet" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="unit_packing" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit / Packing</FormLabel>
                  <FormControl><Input placeholder="e.g. Strip of 10" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="store_location" render={({ field }) => (
                <FormItem>
                  <FormLabel>Store Location</FormLabel>
                  <FormControl><Input placeholder="e.g. Shelf A1" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="min_level" render={({ field }) => (
                <FormItem>
                  <FormLabel>Min Level</FormLabel>
                  <FormControl><Input type="number" min="0" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="reorder_level" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reorder Level</FormLabel>
                  <FormControl><Input type="number" min="0" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent position="popper">
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving...' : isEdit ? 'Update Medicine' : 'Add Medicine'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
