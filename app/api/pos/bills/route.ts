import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateLineItem } from '@/lib/utils/billing'

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
    data.items.map((item: any) => {
      const line = calculateLineItem({
        qty: item.qty,
        unit_price: item.sale_price,
        discount_type: item.discount_type,
        discount_value: item.discount_value,
        tax: item.tax,
      })
      return {
        bill_id:        bill.id,
        medicine_id:    item.medicine_id,
        medicine_name:  item.medicine_name ?? null,
        stock_batch_id: item.stock_batch_id,
        batch_no:       item.batch_no,
        expiry_date:    item.expiry_date,
        qty:            item.qty,
        sale_price:     item.sale_price,
        discount_type:  item.discount_type,
        discount_value: item.discount_value,
        tax:            item.tax,
        price:          line.price,
      }
    })
  )

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Deduct stock atomically — avoids read-then-write race condition.
  // deduct_batch_stock() runs a single UPDATE in Postgres so concurrent bills
  // for the same batch cannot both pass and oversell stock.
  for (const item of data.items) {
    await supabase.rpc('deduct_batch_stock', {
      p_batch_id: item.stock_batch_id,
      p_qty:      item.qty,
    })
  }

  return NextResponse.json({ bill_no: bill.bill_no, id: bill.id })
}

// ─── Update an existing POS bill ─────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const data = await req.json()
  const billId = data.id

  if (!billId) {
    return NextResponse.json({ error: 'Bill ID is required' }, { status: 400 })
  }

  // 1. Verify bill exists and is not cancelled
  const { data: existingBill } = await supabase
    .from('pos_bills')
    .select('id, status, bill_no')
    .eq('id', billId)
    .single()

  if (!existingBill) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  }
  if (existingBill.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot edit a cancelled bill' }, { status: 422 })
  }

  // 2. Fetch old bill items to restore stock
  const { data: oldItems } = await supabase
    .from('pos_bill_items')
    .select('stock_batch_id, qty')
    .eq('bill_id', billId)

  // 3. Restore old stock
  if (oldItems && oldItems.length > 0) {
    for (const item of oldItems) {
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

  // 4. Validate new stock availability
  for (const item of data.items) {
    const { data: batch } = await supabase
      .from('stock_batches')
      .select('available_qty, batch_no')
      .eq('id', item.stock_batch_id)
      .single()

    if (!batch || batch.available_qty < item.qty) {
      // Rollback: re-deduct old stock that we just restored
      if (oldItems && oldItems.length > 0) {
        for (const old of oldItems) {
          if (!old.stock_batch_id) continue
          await supabase.rpc('deduct_batch_stock', {
            p_batch_id: old.stock_batch_id,
            p_qty: old.qty,
          })
        }
      }
      return NextResponse.json(
        {
          error: `Insufficient stock for batch ${item.batch_no ?? batch?.batch_no}. Available: ${batch?.available_qty ?? 0}`,
        },
        { status: 422 }
      )
    }
  }

  // 5. Delete old bill items
  await supabase.from('pos_bill_items').delete().eq('bill_id', billId)

  // 6. Insert new bill items
  const { error: itemsError } = await supabase.from('pos_bill_items').insert(
    data.items.map((item: any) => {
      const line = calculateLineItem({
        qty: item.qty,
        unit_price: item.sale_price,
        discount_type: item.discount_type,
        discount_value: item.discount_value,
        tax: item.tax,
      })
      return {
        bill_id:        billId,
        medicine_id:    item.medicine_id,
        medicine_name:  item.medicine_name ?? null,
        stock_batch_id: item.stock_batch_id,
        batch_no:       item.batch_no,
        expiry_date:    item.expiry_date,
        qty:            item.qty,
        sale_price:     item.sale_price,
        discount_type:  item.discount_type,
        discount_value: item.discount_value,
        tax:            item.tax,
        price:          line.price,
      }
    })
  )

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // 7. Deduct new stock
  for (const item of data.items) {
    await supabase.rpc('deduct_batch_stock', {
      p_batch_id: item.stock_batch_id,
      p_qty: item.qty,
    })
  }

  // 8. Update bill header
  const { error: billError } = await supabase
    .from('pos_bills')
    .update({
      customer_name:  data.customer_name ?? null,
      customer_email: data.customer_email ?? null,
      customer_phone: data.customer_phone ?? null,
      doctor:         data.doctor ?? null,
      payment_method: data.payment_method,
      subtotal:       data.subtotal,
      discount_total: data.discount_total,
      tax_total:      data.tax_total,
      total:          data.total,
      paid:           data.paid,
      due:            data.due,
      note:           data.note ?? null,
      bill_date:      data.bill_date,
    })
    .eq('id', billId)

  if (billError) {
    return NextResponse.json({ error: billError.message }, { status: 500 })
  }

  return NextResponse.json({ bill_no: existingBill.bill_no, id: billId })
}
