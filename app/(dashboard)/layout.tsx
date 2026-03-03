import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { LoginSuccessToast } from '@/components/auth/login-success-toast'

// All dashboard routes fetch user-specific data on every request
export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <DashboardShell profile={profile}>
      <Suspense>
        <LoginSuccessToast name={profile.name} />
      </Suspense>
      {children}
    </DashboardShell>
  )
}
