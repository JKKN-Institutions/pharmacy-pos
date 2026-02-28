import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatINR } from '@/lib/utils/currency'
import { format } from 'date-fns'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { PurchaseViewActions } from '@/components/purchases/purchase-view-actions'

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
      {/* PageHeader: title="Purchase View", breadcrumb, + action buttons */}
      <PageHeader title="Purchase View">
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

      {/* Supplier + Invoice info — 2-column layout inside a Card */}
      <Card className="rounded-xl shadow-sm">
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
            {/* Left: Supplier info */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Supplier</p>
              <p className="font-bold text-base">{supplier?.name ?? '—'}</p>
              {supplier?.email && (
                <p className="text-sm text-muted-foreground">{supplier.email}</p>
              )}
              {supplier?.phone && (
                <p className="text-sm text-muted-foreground">{supplier.phone}</p>
              )}
            </div>

            {/* Right: Invoice details — right-aligned */}
            <div className="text-sm sm:text-right space-y-1.5">
              <div className="flex gap-6 sm:justify-end">
                <span className="text-muted-foreground">Invoice Number</span>
                <span className="font-medium tabular-nums">{purchase.invoice_no}</span>
              </div>
              <div className="flex gap-6 sm:justify-end">
                <span className="text-muted-foreground">Purchase Date</span>
                <span>{format(new Date(purchase.purchase_date), 'dd/MM/yyyy')}</span>
              </div>
              <div className="flex gap-6 sm:justify-end">
                <span className="text-muted-foreground">#</span>
                <span className="font-mono font-medium text-muted-foreground">{purchase.invoice_no}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-0">
          {!items || items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No line items recorded for this purchase.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-semibold text-xs">Name</TableHead>
                    <TableHead className="font-semibold text-xs">BatchNo</TableHead>
                    <TableHead className="font-semibold text-xs">ExpiryDate</TableHead>
                    <TableHead className="font-semibold text-xs text-right">PackingQty</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Quantity</TableHead>
                    <TableHead className="font-semibold text-xs text-right">PurchasePrice</TableHead>
                    <TableHead className="font-semibold text-xs text-right">SalePrice</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Discount</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Tax</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any) => (
                    <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-sm">
                        {item.medicines?.name ?? item.medicine_id}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.batch_no ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {item.expiry_date
                          ? format(new Date(item.expiry_date), 'MM-yyyy')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {item.packing_qty ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {item.quantity ?? item.total_qty ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatINR(item.purchase_price ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatINR(item.sale_price ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {formatINR(item.item_discount ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {formatINR(item.item_tax ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-semibold">
                        {formatINR(item.price ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
