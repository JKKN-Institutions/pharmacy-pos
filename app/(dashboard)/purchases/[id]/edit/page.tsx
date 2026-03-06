import { createClient } from '@/lib/supabase/server'
import { fetchAllActiveMedicines } from '@/lib/supabase/queries'
import { notFound } from 'next/navigation'
import { PurchaseForm } from '@/components/purchases/purchase-form'
import type { PurchaseFormInitialData } from '@/components/purchases/purchase-form'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function EditPurchasePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Parallel fetch: purchase header + items + suppliers + active medicines
  const [
    { data: purchase },
    { data: items },
    { data: suppliers },
    activeMedicines,
  ] = await Promise.all([
    supabase
      .from('purchases')
      .select('id, supplier_id, invoice_no, purchase_date')
      .eq('id', id)
      .single(),
    supabase
      .from('purchase_items')
      .select('medicine_id, batch_no, expiry_date, packing_qty, quantity, total_qty, purchase_price, sale_price, discount_type, discount_value, tax, price')
      .eq('purchase_id', id)
      .order('id'),
    supabase.from('suppliers').select('id, name').order('name'),
    fetchAllActiveMedicines(supabase),
  ])

  if (!purchase) notFound()

  // Medicines in a purchase may become inactive after the purchase was created.
  // If we only send active medicines to the form, those inactive medicine IDs
  // won't be found by the combobox and it will show "Select medicine" instead
  // of the actual name. So we merge any missing ones in (regardless of status).
  let medicines = activeMedicines
  if (items && items.length > 0) {
    const activeIds = new Set(medicines.map((m) => m.id))
    const missingIds = items
      .map((i) => i.medicine_id)
      .filter((mid): mid is string => !!mid && !activeIds.has(mid))

    if (missingIds.length > 0) {
      const { data: inactiveMeds } = await supabase
        .from('medicines')
        .select('id, name, company, unit, tax_percent')
        .in('id', missingIds)
      if (inactiveMeds) medicines = [...medicines, ...inactiveMeds]
    }
  }

  // Check if any stock batches from this purchase have been sold
  const { data: soldBatches } = await supabase
    .from('stock_batches')
    .select('id, batch_no, sold_qty')
    .eq('purchase_id', id)
    .gt('sold_qty', 0)

  const hasSoldStock = soldBatches && soldBatches.length > 0

  const initialData: PurchaseFormInitialData = {
    id: purchase.id,
    supplier_id: purchase.supplier_id,
    invoice_no: purchase.invoice_no,
    purchase_date: purchase.purchase_date,
    items: (items ?? []).map(item => ({
      medicine_id: item.medicine_id,
      batch_no: item.batch_no,
      expiry_date: item.expiry_date,
      packing_qty: Number(item.packing_qty) || 1,
      quantity: Number(item.quantity) || 0,
      total_qty: Number(item.total_qty) || 0,
      purchase_price: Number(item.purchase_price) || 0,
      sale_price: Number(item.sale_price) || 0,
      discount_type: (item.discount_type as 'percent' | 'flat') || 'percent',
      discount_value: Number(item.discount_value) || 0,
      tax: Number(item.tax) || 0,
      price: Number(item.price) || 0,
    })),
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Purchase" description={`Editing invoice ${purchase.invoice_no}`} inline>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/purchases/${id}`}>
            <ChevronLeft className="w-4 h-4 mr-1" />Back
          </Link>
        </Button>
      </PageHeader>

      {hasSoldStock && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 p-4 space-y-1">
          <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">
            Some batches have been sold
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Batches with sales: {soldBatches.map(b => b.batch_no).join(', ')}.
            Editing quantities for sold batches may affect stock integrity.
          </p>
        </div>
      )}

      <PurchaseForm
        suppliers={suppliers ?? []}
        medicines={medicines}
        initialData={initialData}
      />
    </div>
  )
}
