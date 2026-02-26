import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { formatINR } from '@/lib/utils/currency'
import { format } from 'date-fns'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const paymentStatusColors: Record<string, string> = {
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/30',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
  unpaid: 'bg-red-100 text-red-700 dark:bg-red-900/30',
}

const invoiceStatusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/30',
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, customers(first_name, last_name, phone, email)')
    .eq('id', id)
    .single()

  if (!invoice) notFound()

  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id)
    .order('id')

  const customer = invoice.customers as { first_name: string; last_name: string | null; phone: string; email: string | null } | null

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={invoice.invoice_no}
        description={`Created on ${format(new Date(invoice.invoice_date), 'dd MMM yyyy')}`}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/invoices">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={undefined} id="print-btn">
            <Printer className="w-4 h-4 mr-1" />
            Print
          </Button>
        </div>
      </PageHeader>

      {/* Status badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${paymentStatusColors[invoice.payment_status] ?? ''}`}>
          Payment: {invoice.payment_status}
        </span>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${invoiceStatusColors[invoice.invoice_status] ?? ''}`}>
          Status: {invoice.invoice_status}
        </span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-muted text-muted-foreground">
          {invoice.payment_method}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Invoice info */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Invoice Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice No.</span>
              <span className="font-mono font-medium">{invoice.invoice_no}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice Date</span>
              <span>{format(new Date(invoice.invoice_date), 'dd MMM yyyy')}</span>
            </div>
            {invoice.due_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span>{format(new Date(invoice.due_date), 'dd MMM yyyy')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{format(new Date(invoice.created_at), 'dd MMM yyyy, HH:mm')}</span>
            </div>
          </CardContent>
        </Card>

        {/* Customer info */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Customer</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {customer ? (
              <div className="space-y-2">
                <div className="font-medium">{customer.first_name} {customer.last_name ?? ''}</div>
                <div className="text-muted-foreground">{customer.phone}</div>
                {customer.email && <div className="text-muted-foreground">{customer.email}</div>}
              </div>
            ) : (
              <p className="text-muted-foreground">Walk-in customer</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line items */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Line Items</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Item</th>
                  <th className="pb-2 font-medium text-right">Qty</th>
                  <th className="pb-2 font-medium text-right">Unit Rate</th>
                  <th className="pb-2 font-medium text-right">Discount</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map((item, i) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 pr-3">
                      <div className="font-medium">{item.item_name}</div>
                      {item.item_description && (
                        <div className="text-xs text-muted-foreground">{item.item_description}</div>
                      )}
                    </td>
                    <td className="py-2 text-right">{item.qty}</td>
                    <td className="py-2 text-right">{formatINR(item.unit_cost)}</td>
                    <td className="py-2 text-right text-muted-foreground">
                      {item.discount_value > 0
                        ? item.discount_type === 'percent'
                          ? `${item.discount_value}%`
                          : formatINR(item.discount_value)
                        : '—'}
                    </td>
                    <td className="py-2 text-right font-semibold">{formatINR(item.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Separator className="my-4" />

          {/* Totals */}
          <div className="flex justify-end">
            <div className="space-y-1 text-sm w-56">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatINR(invoice.subtotal)}</span>
              </div>
              {invoice.discount_total > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>- {formatINR(invoice.discount_total)}</span>
                </div>
              )}
              {invoice.tax_total > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span>+ {formatINR(invoice.tax_total)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1 font-bold text-base">
                <span>Total</span>
                <span>{formatINR(invoice.total)}</span>
              </div>
              {invoice.paid > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Paid</span>
                  <span>{formatINR(invoice.paid)}</span>
                </div>
              )}
              {invoice.due > 0 && (
                <div className="flex justify-between text-red-600 font-medium">
                  <span>Due</span>
                  <span>{formatINR(invoice.due)}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {(invoice.customer_note || invoice.terms_conditions) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {invoice.customer_note && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Customer Note</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
                {invoice.customer_note}
              </CardContent>
            </Card>
          )}
          {invoice.terms_conditions && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Terms & Conditions</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
                {invoice.terms_conditions}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
