import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { formatINR } from '@/lib/utils/currency'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'

type InvoiceRow = {
  id: string
  invoice_no: string
  total: number
  paid: number
  due: number
  payment_status: string
  customer_id: string | null
  customer_name: string
  customer_phone: string | null
}

type CustomerLedgerEntry = {
  customer_id: string | null
  customer_name: string
  customer_phone: string | null
  total_invoiced: number
  total_paid: number
  total_outstanding: number
  invoice_count: number
}

const paymentStatusColors: Record<string, string> = {
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/30',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
  unpaid: 'bg-red-100 text-red-700 dark:bg-red-900/30',
}

export default async function AccountReportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('invoices')
    .select(
      'id, invoice_no, total, paid, due, payment_status, customer_id, customer_name, customer_phone'
    )
    .neq('payment_status', 'paid')
    .order('customer_name', { ascending: true })

  if (params.status) query = query.eq('payment_status', params.status)
  const { data: invoices } = await query
  const rows = (invoices ?? []) as InvoiceRow[]
  const ledgerMap = new Map<string, CustomerLedgerEntry>()
  for (const inv of rows) {
    const key = inv.customer_id ?? inv.customer_name ?? 'Unknown'
    const existing = ledgerMap.get(key)
    if (existing) {
      existing.total_invoiced += Number(inv.total)
      existing.total_paid += Number(inv.paid)
      existing.total_outstanding += Number(inv.due)
      existing.invoice_count += 1
    } else {
      ledgerMap.set(key, {
        customer_id: inv.customer_id,
        customer_name: inv.customer_name || 'Unknown',
        customer_phone: inv.customer_phone,
        total_invoiced: Number(inv.total),
        total_paid: Number(inv.paid),
        total_outstanding: Number(inv.due),
        invoice_count: 1,
      })
    }
  }
  const ledger = Array.from(ledgerMap.values()).sort((a, b) => b.total_outstanding - a.total_outstanding)
  const grandTotalInvoiced = ledger.reduce((s, r) => s + r.total_invoiced, 0)
  const grandTotalPaid = ledger.reduce((s, r) => s + r.total_paid, 0)
  const grandTotalOutstanding = ledger.reduce((s, r) => s + r.total_outstanding, 0)
  return (
    <div className="space-y-6">
      <PageHeader
        title="Account Report"
        description={`Customer credit ledger - ${ledger.length} customers with outstanding dues`}
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/reports">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Reports
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Total Invoiced (Unpaid)</p>
            <p className="text-2xl font-bold">{formatINR(grandTotalInvoiced)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Total Collected</p>
            <p className="text-2xl font-bold text-green-600">{formatINR(grandTotalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Total Outstanding</p>
            <p className="text-2xl font-bold text-red-600">{formatINR(grandTotalOutstanding)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="text-left p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Customer</th>
                  <th className="text-left p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Phone</th>
                  <th className="text-right p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Invoices</th>
                  <th className="text-right p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Total Invoiced</th>
                  <th className="text-right p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Total Paid</th>
                  <th className="text-right p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Outstanding</th>
                  <th className="text-center p-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ledger.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">No outstanding dues found</td>
                  </tr>
                ) : (
                  ledger.map((entry, idx) => {
                    const statusKey = entry.total_outstanding <= 0 ? 'paid' : entry.total_paid > 0 ? 'partial' : 'unpaid'
                    const statusLabel = statusKey === 'paid' ? 'Paid' : statusKey === 'partial' ? 'Partial' : 'Unpaid'
                    return (
                      <tr key={entry.customer_id ?? idx} className="hover:bg-muted/20">
                        <td className="p-4 font-medium">{entry.customer_name}</td>
                        <td className="p-4 text-muted-foreground">{entry.customer_phone ?? '---'}</td>
                        <td className="p-4 text-right">{entry.invoice_count}</td>
                        <td className="p-4 text-right font-semibold">{formatINR(entry.total_invoiced)}</td>
                        <td className="p-4 text-right text-green-600 font-medium">{formatINR(entry.total_paid)}</td>
                        <td className="p-4 text-right font-bold text-red-600">{formatINR(entry.total_outstanding)}</td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentStatusColors[statusKey]}`}>{statusLabel}</span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              {ledger.length > 0 && (
                <tfoot className="bg-muted/40 border-t">
                  <tr>
                    <td colSpan={3} className="p-4 font-semibold text-sm">Total</td>
                    <td className="p-4 text-right font-bold">{formatINR(grandTotalInvoiced)}</td>
                    <td className="p-4 text-right font-bold text-green-600">{formatINR(grandTotalPaid)}</td>
                    <td className="p-4 text-right font-bold text-red-600">{formatINR(grandTotalOutstanding)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}