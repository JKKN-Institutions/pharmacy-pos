'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const invoiceItemSchema = z.object({
  item_name: z.string().min(1),
  item_description: z.string().optional(),
  qty: z.coerce.number().min(1),
  unit_cost: z.coerce.number().min(0),
  discount_type: z.enum(['percent', 'flat']).default('percent'),
  discount_value: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
  price: z.coerce.number().min(0),
})

const invoiceSchema = z.object({
  customer_id: z.string().uuid().optional().or(z.literal('')),
  payment_method: z.enum(['cash', 'upi', 'card', 'credit']).default('credit'),
  payment_status: z.enum(['paid', 'partial', 'unpaid']).default('unpaid'),
  invoice_status: z.enum(['draft', 'sent', 'paid']).default('draft'),
  invoice_date: z.string().min(1),
  due_date: z.string().optional(),
  customer_note: z.string().optional(),
  terms_conditions: z.string().optional(),
})

export async function createInvoiceAction(data: {
  invoice: z.infer<typeof invoiceSchema>
  items: z.infer<typeof invoiceItemSchema>[]
  subtotal: number
  discount_total: number
  tax_total: number
  total: number
  paid: number
  due: number
}) {
  const supabase = await createClient()
  const { data: branch } = await supabase.from('branches').select('id').limit(1).single()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('user_profiles').select('id').eq('auth_user_id', user.id).single()
    : { data: null }

  const invoiceNo = `INV-${String(Date.now()).slice(-5)}`

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      ...data.invoice,
      invoice_no: invoiceNo,
      customer_id: data.invoice.customer_id || null,
      due_date: data.invoice.due_date || null,
      subtotal: data.subtotal,
      discount_total: data.discount_total,
      tax_total: data.tax_total,
      total: data.total,
      paid: data.paid,
      due: data.due,
      branch_id: branch?.id,
      created_by: profile?.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await supabase.from('invoice_items').insert(
    data.items.map(item => ({ ...item, invoice_id: invoice.id }))
  )

  revalidatePath('/invoices')
  redirect('/invoices')
}

export async function deleteInvoiceAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('invoices').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/invoices')
  return { success: true }
}
