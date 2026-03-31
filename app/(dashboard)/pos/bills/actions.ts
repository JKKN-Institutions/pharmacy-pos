'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/utils/activity-logger'

// ─── Paginated bills query ────────────────────────────────────────────────────

export interface FetchBillsParams {
  page: number
  pageSize: number
  search?: string
  status?: string
  payment?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface FetchBillsResult {
  data: any[]
  totalCount: number
}

export async function fetchBillsAction(params: FetchBillsParams): Promise<FetchBillsResult> {
  const {
    page,
    pageSize,
    search,
    status,
    payment,
    dateFrom,
    dateTo,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = params

  const supabase = await createClient()

  let query = supabase
    .from('pos_bills')
    .select('*', { count: 'exact' })

  // ── Filters ──
  if (search) {
    // Search by bill_no, customer_name, or customer_phone
    query = query.or(
      `bill_no.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`
    )
  }
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  if (payment && payment !== 'all') {
    query = query.eq('payment_method', payment)
  }
  if (dateFrom) {
    query = query.gte('bill_date', dateFrom)
  }
  if (dateTo) {
    query = query.lte('bill_date', dateTo)
  }

  // ── Sorting ──
  const validSortColumns = ['bill_no', 'customer_name', 'subtotal', 'tax_total', 'discount_total', 'total', 'bill_date', 'created_at', 'payment_method', 'status']
  const col = validSortColumns.includes(sortBy) ? sortBy : 'created_at'
  query = query.order(col, { ascending: sortOrder === 'asc' })

  // ── Pagination ──
  const from = page * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, count, error } = await query

  if (error) {
    console.error('[fetchBills] query failed:', error.message)
    return { data: [], totalCount: 0 }
  }

  return {
    data: data ?? [],
    totalCount: count ?? 0,
  }
}

// ─── Summary stats (separate lightweight queries) ─────────────────────────────

export async function fetchBillsSummaryAction() {
  const supabase = await createClient()

  // Total revenue — sum of completed bills
  const { data: totalData } = await supabase
    .from('pos_bills')
    .select('total')
    .in('status', ['paid', 'saved'])

  const totalRevenue = (totalData ?? []).reduce((sum, b) => sum + (b.total ?? 0), 0)

  // Today's revenue
  const todayStr = new Date().toISOString().slice(0, 10)
  const { data: todayData } = await supabase
    .from('pos_bills')
    .select('total')
    .in('status', ['paid', 'saved'])
    .eq('bill_date', todayStr)

  const todayRevenue = (todayData ?? []).reduce((sum, b) => sum + (b.total ?? 0), 0)

  // Pending count
  const { count: pendingCount } = await supabase
    .from('pos_bills')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  return {
    totalRevenue,
    todayRevenue,
    pendingCount: pendingCount ?? 0,
  }
}

export async function getPharmacySettingsAction(): Promise<Record<string, string>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['store_name', 'store_address', 'store_phone', 'store_gstin', 'store_dl', 'invoice_footer'])
  if (!data) return {}
  return Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]))
}

export async function getBillItemsAction(billId: string) {
  if (!billId) return { data: null, error: 'Bill ID is required' }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pos_bill_items')
    .select('id, medicine_name, batch_no, qty, sale_price, price')
    .eq('bill_id', billId)
    .order('id')
  if (error) return { data: null, error: error.message }
  return { data }
}

// ─── Fetch full bill items for editing ────────────────────────────────────────

export async function getBillItemsForEditAction(billId: string) {
  if (!billId) return { data: null, error: 'Bill ID is required' }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pos_bill_items')
    .select('id, medicine_id, medicine_name, stock_batch_id, batch_no, expiry_date, qty, sale_price, discount_type, discount_value, tax, price')
    .eq('bill_id', billId)
    .order('id')

  if (error) return { data: null, error: error.message }

  // Also fetch available_qty for each batch (add back the sold qty from this bill)
  if (data) {
    for (const item of data as any[]) {
      if (item.stock_batch_id) {
        const { data: batch } = await supabase
          .from('stock_batches')
          .select('available_qty')
          .eq('id', item.stock_batch_id)
          .single()
        // available_qty for editing = current available + what this bill consumed
        item.available_qty = (batch?.available_qty ?? 0) + item.qty
      }
    }
  }

  return { data }
}

export async function cancelBillAction(id: string, reason: string) {
  if (!id) return { error: 'Bill ID is required' }
  if (!reason.trim()) return { error: 'Cancellation reason is required' }

  const supabase = await createClient()

  // 0. Verify bill exists and is not already cancelled
  const { data: bill } = await supabase
    .from('pos_bills')
    .select('id, status, bill_no')
    .eq('id', id)
    .single()

  if (!bill) return { error: 'Bill not found' }
  if (bill.status === 'cancelled') return { error: 'Bill is already cancelled' }

  // 1. Get current user for cancelled_by
  const { data: { user } } = await supabase.auth.getUser()
  let profileId: string | null = null
  let profileName = 'Unknown'
  let profileBranchId: string | undefined
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, name, branch_id')
      .eq('auth_user_id', user.id)
      .single()
    profileId = profile?.id ?? null
    profileName = profile?.name ?? 'Unknown'
    profileBranchId = profile?.branch_id ?? undefined
  }

  // 2. Fetch bill items — needed to restore stock
  const { data: billItems } = await supabase
    .from('pos_bill_items')
    .select('stock_batch_id, qty')
    .eq('bill_id', id)

  // 3. Restore stock for each line item
  if (billItems && billItems.length > 0) {
    for (const item of billItems) {
      if (!item.stock_batch_id) continue

      const { data: batch } = await supabase
        .from('stock_batches')
        .select('available_qty, sold_qty')
        .eq('id', item.stock_batch_id)
        .single()

      if (batch) {
        await supabase
          .from('stock_batches')
          .update({
            available_qty: Number(batch.available_qty) + Number(item.qty),
            sold_qty: Math.max(0, Number(batch.sold_qty) - Number(item.qty)),
          })
          .eq('id', item.stock_batch_id)
      }
    }
  }

  // 4. Update bill status to cancelled (preserve the record — don't delete)
  const { error } = await supabase
    .from('pos_bills')
    .update({
      status: 'cancelled',
      cancel_reason: reason.trim(),
      cancelled_at: new Date().toISOString(),
      cancelled_by: profileId,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  await logActivity({
    userId: user?.id ?? '',
    userName: profileName,
    branchId: profileBranchId,
    action: 'CANCEL',
    entityType: 'pos_bill',
    entityId: id,
    entityLabel: bill.bill_no,
    details: { reason: reason.trim() },
  })

  revalidatePath('/pos/bills')
  revalidatePath('/pos')
  revalidatePath('/stock')
  return { success: true }
}
