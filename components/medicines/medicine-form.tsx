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
import type { Medicine, MedicineCategory, TaxRate } from '@/lib/types/database'
import { PackageCheck } from 'lucide-react'
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
  tax_percent: z.coerce.number().min(0).max(100).default(0),
  status: z.enum(['active', 'inactive']).default('active'),
})

type FormValues = z.infer<typeof schema>

interface MedicineFormProps {
  medicine?: Medicine
  categories: Pick<MedicineCategory, 'id' | 'name'>[]
  taxRates: Pick<TaxRate, 'id' | 'name' | 'rate'>[]
  liveStock?: number
}
export function MedicineForm({ medicine, categories, taxRates, liveStock }: MedicineFormProps) {
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
      tax_percent: medicine?.tax_percent ?? 0,
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
              {/* Live Stock — read-only, shown only in edit mode */}
              {isEdit && liveStock !== undefined && (
                <div className="sm:col-span-2">
                  <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                    liveStock <= (medicine?.min_level ?? 0)
                      ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                      : liveStock <= (medicine?.reorder_level ?? 0)
                        ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
                        : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                  }`}>
                    <PackageCheck className={`h-5 w-5 shrink-0 ${
                      liveStock <= (medicine?.min_level ?? 0)
                        ? 'text-red-600 dark:text-red-400'
                        : liveStock <= (medicine?.reorder_level ?? 0)
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                    }`} />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Stock</p>
                      <p className={`text-2xl font-bold tabular-nums leading-tight ${
                        liveStock <= (medicine?.min_level ?? 0)
                          ? 'text-red-700 dark:text-red-300'
                          : liveStock <= (medicine?.reorder_level ?? 0)
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {liveStock.toLocaleString()}
                        <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                          {medicine?.unit ?? 'units'}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {liveStock <= (medicine?.min_level ?? 0)
                          ? 'Critically low — below minimum level'
                          : liveStock <= (medicine?.reorder_level ?? 0)
                            ? 'Low — consider reordering'
                            : 'Stock is healthy'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
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
              <FormField control={form.control} name="tax_percent" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax Rate (GST)</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(parseFloat(v))}
                    value={String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select tax rate" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent position="popper">
                      <SelectItem value="0">No Tax — 0%</SelectItem>
                      {taxRates.map(tr => (
                        <SelectItem key={tr.id} value={String(tr.rate)}>
                          {tr.name} — {Number(tr.rate).toFixed(2)}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
                {form.formState.isSubmitting ? 'Saving...' : isEdit ? 'Update Medicine' : 'Add Medicine'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
