'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function importMedicinesAction(rows: Array<Record<string, string>>) {
  if (!rows.length) return { error: 'No rows to import' }
  const supabase = await createClient()
  const { data: branch } = await supabase.from('branches').select('id').limit(1).single()
  if (!branch?.id) return { error: 'Could not determine branch' }

  const records = rows.map((r) => ({
    branch_id: branch.id,
    name: (r.name ?? '').trim(),
    generic_name: (r.generic_name ?? '').trim(),
    company: (r.company ?? '').trim(),
    unit: (r.unit ?? 'Strip').trim(),
    min_level: parseInt(r.min_level ?? '10', 10) || 10,
    reorder_level: parseInt(r.reorder_level ?? '20', 10) || 20,
    status: 'active',
    tax_percent: 0,
    is_active: true,
  })).filter((r) => r.name)

  if (!records.length) return { error: 'No valid rows found. Ensure name column is present.' }

  const { error } = await supabase.from('medicines').insert(records)
  if (error) return { error: error.message }
  revalidatePath('/medicines')
  return { success: true, count: records.length }
}

export async function importCustomersAction(rows: Array<Record<string, string>>) {
  if (!rows.length) return { error: 'No rows to import' }
  const supabase = await createClient()
  const { data: branch } = await supabase.from('branches').select('id').limit(1).single()
  if (!branch?.id) return { error: 'Could not determine branch' }

  const records = rows.map((r) => ({
    branch_id: branch.id,
    name: ((r.first_name ?? '') + ' ' + (r.last_name ?? '')).trim(),
    phone: (r.phone ?? '').trim(),
    email: (r.email ?? '').trim() || null,
    address: (r.city ?? '').trim() || null,
    loyalty_points: 0,
    is_active: true,
  })).filter((r) => r.phone)

  if (!records.length) return { error: 'No valid rows found. Ensure phone column is present.' }

  const { error } = await supabase.from('customers').insert(records)
  if (error) return { error: error.message }
  revalidatePath('/customers')
  return { success: true, count: records.length }
}

export async function importSuppliersAction(rows: Array<Record<string, string>>) {
  if (!rows.length) return { error: 'No rows to import' }
  const supabase = await createClient()
  const { data: branch } = await supabase.from('branches').select('id').limit(1).single()
  if (!branch?.id) return { error: 'Could not determine branch' }

  const records = rows.map((r) => ({
    branch_id: branch.id,
    name: (r.name ?? '').trim(),
    phone: (r.phone ?? '').trim(),
    email: (r.email ?? '').trim() || null,
    address: (r.city ?? '').trim() || null,
    is_active: true,
  })).filter((r) => r.name)

  if (!records.length) return { error: 'No valid rows found. Ensure name column is present.' }

  const { error } = await supabase.from('suppliers').insert(records)
  if (error) return { error: error.message }
  revalidatePath('/suppliers')
  return { success: true, count: records.length }
}
