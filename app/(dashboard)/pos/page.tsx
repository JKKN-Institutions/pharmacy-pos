import { createClient } from '@/lib/supabase/server'
import { PosPageClient } from './_components/pos-page-client'

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

  const { data: bills, count } = await supabase
    .from('pos_bills')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  const billsData = bills ?? []
  const completedStatuses = ['paid', 'saved']

  const totalRevenue = billsData
    .filter((b) => completedStatuses.includes(b.status ?? ''))
    .reduce((sum, b) => sum + (b.total ?? 0), 0)

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayRevenue = billsData
    .filter(
      (b) =>
        completedStatuses.includes(b.status ?? '') &&
        b.bill_date?.slice(0, 10) === todayStr
    )
    .reduce((sum, b) => sum + (b.total ?? 0), 0)

  const pendingCount = billsData.filter((b) => b.status === 'pending').length

  return (
    <PosPageClient
      userId={profile?.id}
      branchId={profile?.branch_id}
      bills={billsData}
      totalBills={count ?? 0}
      totalRevenue={totalRevenue}
      todayRevenue={todayRevenue}
      pendingCount={pendingCount}
    />
  )
}
