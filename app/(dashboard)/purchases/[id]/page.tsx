import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { formatINR } from '@/lib/utils/currency'
import { format } from 'date-fns'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { PurchaseViewActions } from '@/components/purchases/purchase-view-actions'
import { PurchaseItemsTable } from '@/components/purchases/purchase-items-table'
import type { PurchaseItem } from '@/components/purchases/purchase-items-table'

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: purchase }, { data: items }] = await Promise.all([
    supabase
      .from('purchases')
      .select('*, suppliers(name, phone, email, address)')
      .eq('id', id)
      .single(),
    supabase
      .from('purchase_items')
      .select('*, medicines(name)')
      .eq('purchase_id', id)
      .order('id'),
  ])

  if (!purchase) notFound()

  const supplier = (purchase as any).suppliers

  return (
    <div className="space-y-6">

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <PageHeader title="Purchase View" inline>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/purchases">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back
            </Link>
          </Button>
          <PurchaseViewActions id={id} />
        </div>
      </PageHeader>

      {/* ── Supplier + Invoice card ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-card rounded-2xl border shadow-sm p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:justify-between">

          {/* Left: Supplier */}
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              Supplier
            </p>
            <p className="font-bold text-base">{supplier?.name ?? '—'}</p>
            {supplier?.email && (
              <p className="text-sm text-muted-foreground">{supplier.email}</p>
            )}
            {supplier?.phone && (
              <p className="text-sm text-muted-foreground">{supplier.phone}</p>
            )}
          </div>

          {/* Right: Invoice meta */}
          <div className="sm:text-right space-y-2 text-sm">
            <div className="flex items-center gap-8 sm:justify-end">
              <span className="text-muted-foreground w-32 sm:w-auto">Invoice Number</span>
              <span className="font-semibold tabular-nums">{purchase.invoice_no}</span>
            </div>
            <div className="flex items-center gap-8 sm:justify-end">
              <span className="text-muted-foreground w-32 sm:w-auto">Purchase Date</span>
              <span>{format(new Date(purchase.purchase_date), 'dd/MM/yyyy')}</span>
            </div>
            <div className="flex items-center gap-8 sm:justify-end">
              <span className="text-muted-foreground w-32 sm:w-auto">#</span>
              <span className="font-mono text-muted-foreground">{purchase.invoice_no}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Items table (TanStack Table client component) ───────────────────── */}
      <PurchaseItemsTable
        items={(items ?? []) as PurchaseItem[]}
        subtotal={Number(purchase.subtotal ?? 0)}
        tax={Number(purchase.tax ?? 0)}
        discount={Number(purchase.discount ?? 0)}
        total={Number(purchase.total ?? 0)}
      />

    </div>
  )
}
