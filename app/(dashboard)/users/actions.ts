'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'manager', 'pharmacist', 'cashier']),
  branch_id: z.string().min(1, 'Branch is required'),
})

export async function createUserAction(formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    phone: formData.get('phone') as string || undefined,
    role: formData.get('role') as string,
    branch_id: formData.get('branch_id') as string,
  }

  const parsed = userSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: parsed.data.email,
    email_confirm: true,
  })

  if (authError) return { error: authError.message }

  const { error: profileError } = await supabase.from('user_profiles').insert({
    auth_user_id: authData.user.id,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    role: parsed.data.role,
    branch_id: parsed.data.branch_id,
  })

  if (profileError) {
    // Rollback: remove the auth user so the email doesn't become a ghost entry
    await adminClient.auth.admin.deleteUser(authData.user.id)
    return { error: profileError.message }
  }

  revalidatePath('/users')
  return { success: true }
}

export async function updateUserAction(id: string, formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    phone: formData.get('phone') as string || undefined,
    role: formData.get('role') as string,
    branch_id: formData.get('branch_id') as string,
  }
  const schema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    phone: z.string().optional(),
    role: z.enum(['admin', 'manager', 'pharmacist', 'cashier']),
    branch_id: z.string().min(1, 'Branch is required'),
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('user_profiles')
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone ?? null,
      role: parsed.data.role,
      branch_id: parsed.data.branch_id,
    })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/users')
  return { success: true }
}

export async function updateUserRoleAction(id: string, role: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('user_profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/users')
  return { success: true }
}

export async function toggleUserStatusAction(id: string, is_active: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('user_profiles')
    .update({ is_active })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/users')
  return { success: true }
}

export async function deleteUserAction(id: string) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Fetch auth_user_id before deleting the profile row
  const { data: profile, error: fetchError } = await supabase
    .from('user_profiles')
    .select('auth_user_id')
    .eq('id', id)
    .single()

  if (fetchError) return { error: fetchError.message }

  const { error: profileError } = await supabase
    .from('user_profiles')
    .delete()
    .eq('id', id)

  if (profileError) return { error: profileError.message }

  // Also delete from auth.users so the email is freed for future registration
  if (profile?.auth_user_id) {
    await adminClient.auth.admin.deleteUser(profile.auth_user_id)
  }

  revalidatePath('/users')
  return { success: true }
}
