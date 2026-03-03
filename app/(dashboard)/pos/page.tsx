import { createClient } from '@/lib/supabase/server'
import { PosPageClient } from './_components/pos-page-client'
import { fetchBillsAction, fetchBillsSummaryAction } from './bills/actions'

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

  // Parallel fetch: first page of bills + summary stats
  const [billsResult, summary] = await Promise.all([
    fetchBillsAction({ page: 0, pageSize: 15, sortBy: 'created_at', sortOrder: 'desc' }),
    fetchBillsSummaryAction(),
  ])

  return (
    <PosPageClient
      userId={profile?.id}
      branchId={profile?.branch_id}
      initialBills={billsResult.data as any}
      initialTotalCount={billsResult.totalCount}
      totalRevenue={summary.totalRevenue}
      todayRevenue={summary.todayRevenue}
      pendingCount={summary.pendingCount}
    />
  )
}
