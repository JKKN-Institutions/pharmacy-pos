import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatINR } from '@/lib/utils/currency'
import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { PurchaseStatus } from '@/lib/types/database'

const statusStyles: Record<PurchaseStatus, string> = {
  received:       'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  returned:       'border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-950/40 dark:text-red-400',
  partial_return: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
}

const statusLabel: Record<PurchaseStatus, string> = {
  received:       'Received',
  returned:       'Returned',
  partial_return: 'Partial Return',
}

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

  const status = purchase.status as PurchaseStatus

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Purchase — ${purchase.invoice_no}`}
        description={format(new Date(purchase.purchase_date), 'dd MMMM yyyy')}
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/purchases">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
      </PageHeader>

      {/* Header Info */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Supplier */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Supplier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="font-semibold">{(purchase as any).suppliers?.name ?? '—'}</p>
            {(purchase as any).suppliers?.phone && (
              <p className="text-sm text-muted-foreground">{(purchase as any).suppliers.phone}</p>
            )}
            {(purchase as any).suppliers?.email && (
              <p className="text-sm text-muted-foreground">{(purchase as any).suppliers.email}</p>
            )}
          </CardContent>
        </Card>

        {/* Invoice Info */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Invoice No.</span>
              <span className="font-mono font-medium">{purchase.invoice_no}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date</span>
              <span>{format(new Date(purchase.purchase_date), 'dd MMM yyyy')}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline" className={`text-xs ${statusStyles[status] ?? ''}`}>
                {statusLabel[status] ?? status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Totals Summary */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatINR(purchase.subtotal ?? 0)}</span>
            </div>
            {Number(purchase.discount ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  −{formatINR(purchase.discount ?? 0)}
                </span>
              </div>
            )}
            {Number(purchase.tax ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatINR(purchase.tax ?? 0)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-1">
              <span>Total</span>
              <span>{formatINR(purchase.total ?? 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Purchase Items
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({items?.length ?? 0} {items?.length === 1 ? 'item' : 'items'})
            </span>
          </CardTitle>
        </CardHeader>
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
                    <TableHead className="font-semibold text-xs uppercase">Medicine</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Batch No.</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Expiry</TableHead>
                    <TableHead className="font-semibold text-xs uppercase text-right">Qty</TableHead>
                    <TableHead className="font-semibold text-xs uppercase text-right">Purchase Price</TableHead>
                    <TableHead className="font-semibold text-xs uppercase text-right">Sale Price</TableHead>
                    <TableHead className="font-semibold text-xs uppercase text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any) => (
                    <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">
                        {item.medicines?.name ?? item.medicine_id}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {item.batch_no ?? item.batch_number ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {item.expiry_date
                          ? format(new Date(item.expiry_date), 'MMM yyyy')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {item.total_qty ?? item.quantity ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatINR(item.purchase_price ?? item.cost_price ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatINR(item.sale_price ?? item.selling_price ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {formatINR(item.price ?? item.total ?? 0)}
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
