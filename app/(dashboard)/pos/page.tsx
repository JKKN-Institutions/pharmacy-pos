import { createClient } from '@/lib/supabase/server'
import { PosClient } from './_components/pos-client'

export default async function POSPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, name, branch_id, role')
      .eq('auth_user_id', user.id)
      .single()
    profile = data
  }

  return <PosClient userId={profile?.id} branchId={profile?.branch_id} />
}
