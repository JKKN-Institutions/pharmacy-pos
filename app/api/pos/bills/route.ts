import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const data = await req.json()

  // Hard block: validate stock availability for each item
  for (const item of data.items) {
    const { data: batch } = await supabase
      .from('stock_batches')
      .select('available_qty, batch_no')
      .eq('id', item.stock_batch_id)
      .single()

    if (!batch || batch.available_qty < item.qty) {
      return NextResponse.json(
        {
          error: `Insufficient stock for batch ${item.batch_no ?? batch?.batch_no}. Available: ${batch?.available_qty ?? 0}`,
        },
        { status: 422 }
      )
    }
  }

  // Get user profile (branch_id must match get_user_branch() for RLS)
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('user_profiles').select('id, branch_id').eq('auth_user_id', user.id).single()
    : { data: null }

  // Generate bill number via DB sequence
  const { data: billNo } = await supabase.rpc('generate_bill_no')

  // Insert POS bill
  const { data: bill, error: billError } = await supabase
    .from('pos_bills')
    .insert({
      bill_no: billNo,
      customer_name: data.customer_name ?? null,
      customer_email: data.customer_email ?? null,
      customer_phone: data.customer_phone ?? null,
      doctor: data.doctor ?? null,
      payment_method: data.payment_method,
      subtotal: data.subtotal,
      discount_total: data.discount_total,
      tax_total: data.tax_total,
      total: data.total,
      paid: data.paid,
      due: data.due,
      note: data.note ?? null,
      bill_date: data.bill_date,
      status: 'saved',
      branch_id: profile?.branch_id ?? null,
      created_by: profile?.id ?? null,
    })
    .select('id, bill_no')
    .single()

  if (billError) {
    return NextResponse.json({ error: billError.message }, { status: 500 })
  }

  // Insert bill line items
  const { error: itemsError } = await supabase.from('pos_bill_items').insert(
    data.items.map((item: any) => ({
      bill_id: bill.id,
      medicine_id: item.medicine_id,
      stock_batch_id: item.stock_batch_id,
      batch_no: item.batch_no,
      expiry_date: item.expiry_date,
      qty: item.qty,
      sale_price: item.sale_price,
      discount_type: item.discount_type,
      discount_value: item.discount_value,
      tax: item.tax,
      price: item.price,
    }))
  )

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Atomically deduct stock from each batch using DB function
  for (const item of data.items) {
    await supabase.rpc('deduct_batch_stock', {
      p_batch_id: item.stock_batch_id,
      p_qty: item.qty,
    })
  }

  return NextResponse.json({ bill_no: bill.bill_no, id: bill.id })
}
