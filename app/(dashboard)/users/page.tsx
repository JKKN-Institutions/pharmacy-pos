import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DataTable } from '@/components/ui/data-table'
import { userColumns } from './columns'
import { PageHeader } from '@/components/ui/page-header'
import { UserFormDialog } from '@/components/users/user-form-dialog'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: users } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Manage staff accounts and roles">
        <UserFormDialog />
      </PageHeader>
      <DataTable
        columns={userColumns}
        data={users ?? []}
        searchKey="name"
        searchPlaceholder="Search users..."
      />
    </div>
  )
}
