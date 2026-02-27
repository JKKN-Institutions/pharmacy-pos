import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatINR } from '@/lib/utils/currency'
import { format } from 'date-fns'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { BookOpen, TrendingDown, TrendingUp, Users, AlertCircle } from 'lucide-react'
import React from 'react'

interface InvoiceRow {
  id: string; invoice_no: string; invoice_date: string; total: number
  paid: number; due: number; payment_status: string; customer_id: string | null
  customers: { first_name: string; last_name: string | null; phone: string } | null
}

interface CustomerLedger {
  customer_id: string | null; name: string; phone: string
  totalInvoiced: number; totalPaid: number; totalDue: number; invoiceCount: number; lastInvoiceDate: string
}

export default async function AccountsPage() {
  const supabase = await createClient()

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_no, invoice_date, total, paid, due, payment_status, customer_id, customers(first_name, last_name, phone)')
    .order('invoice_date', { ascending: false })

  const invoicesData = (invoices ?? []) as unknown as InvoiceRow[]
  const todayStr = new Date().toISOString().slice(0, 10)

  const { data: todayBills } = await supabase.from('pos_bills').select('paid').eq('bill_date', todayStr).neq('status', 'cancelled')

  const { data: todayInvoicePaid } = await supabase.from('invoices').select('paid').eq('invoice_date', todayStr).neq('payment_status', 'unpaid')

  const { data: todayExpenses } = await supabase.from('expenses').select('amount').eq('date', todayStr)

  const posCashToday = (todayBills ?? []).reduce((s, b) => s + (b.paid ?? 0), 0)
  const invoicePaidToday = (todayInvoicePaid ?? []).reduce((s, i) => s + (i.paid ?? 0), 0)
  const expensesToday = (todayExpenses ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)
  const totalInflow = posCashToday + invoicePaidToday
  const netCash = totalInflow - expensesToday

  const ledgerMap = new Map<string, CustomerLedger>()
  for (const inv of invoicesData) {
    const key = inv.customer_id ?? ("no-cust-" + inv.invoice_no)
    const customerName = inv.customers ? (inv.customers.first_name + " " + (inv.customers.last_name ?? "")).trim() : "Unknown Customer"
    const phone = inv.customers?.phone ?? "--"
    if (!ledgerMap.has(key)) {
      ledgerMap.set(key, { customer_id: inv.customer_id, name: customerName, phone, totalInvoiced: 0, totalPaid: 0, totalDue: 0, invoiceCount: 0, lastInvoiceDate: inv.invoice_date })
    }
    const entry = ledgerMap.get(key)!
    entry.totalInvoiced += inv.total ?? 0; entry.totalPaid += inv.paid ?? 0; entry.totalDue += inv.due ?? 0; entry.invoiceCount += 1
    if (inv.invoice_date > entry.lastInvoiceDate) entry.lastInvoiceDate = inv.invoice_date
  }

  const ledger = Array.from(ledgerMap.values()).sort((a, b) => b.totalDue - a.totalDue)
  const totalOutstanding = ledger.reduce((s, c) => s + c.totalDue, 0)
  const customersWithDues = ledger.filter((c) => c.totalDue > 0).length
  const totalInvoicedAmt = ledger.reduce((s, c) => s + c.totalInvoiced, 0)
  const totalCollected = ledger.reduce((s, c) => s + c.totalPaid, 0)

  return (
    <div className="space-y-8">
      <PageHeader title="Accounts / Credit Ledger" description="Customer credit invoices and outstanding balances" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={<BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />} iconBg="bg-indigo-100 dark:bg-indigo-900/30" label="Total Invoiced" value={formatINR(totalInvoicedAmt)} />
        <SummaryCard icon={<TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />} iconBg="bg-green-100 dark:bg-green-900/30" label="Total Collected" value={formatINR(totalCollected)} />
        <SummaryCard icon={<AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />} iconBg="bg-red-100 dark:bg-red-900/30" label="Outstanding Balance" value={formatINR(totalOutstanding)} valueClass="text-red-600 dark:text-red-400" />
        <SummaryCard icon={<Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />} iconBg="bg-amber-100 dark:bg-amber-900/30" label="Customers with Dues" value={String(customersWithDues)} />
      </div>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Customer Credit Ledger</CardTitle></CardHeader>
        <CardContent className="p-0">
          {ledger.length === 0 ? (<div className="py-16 text-center text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No invoices found</p>
            <p className="text-sm">Create credit invoices to see the ledger here.</p>
          </div>) : (
            <div className="overflow-x-auto"><Table><TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold text-xs uppercase">Customer</TableHead>
                <TableHead className="font-semibold text-xs uppercase">Phone</TableHead>
                <TableHead className="font-semibold text-xs uppercase text-right">Invoiced</TableHead>
                <TableHead className="font-semibold text-xs uppercase text-right">Paid</TableHead>
                <TableHead className="font-semibold text-xs uppercase text-right">Balance Due</TableHead>
                <TableHead className="font-semibold text-xs uppercase text-center">Bills</TableHead>
                <TableHead className="font-semibold text-xs uppercase">Last Invoice</TableHead>
              </TableRow></TableHeader><TableBody>
              {ledger.map((cust, idx) => (
                <TableRow key={cust.customer_id ?? String(idx)} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium">{cust.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{cust.phone}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(cust.totalInvoiced)}</TableCell>
                  <TableCell className="text-right tabular-nums text-green-600 dark:text-green-400">{formatINR(cust.totalPaid)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className={cust.totalDue > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted-foreground'}>{formatINR(cust.totalDue)}</span>
                  </TableCell>
                  <TableCell className="text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">{cust.invoiceCount}</span></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(cust.lastInvoiceDate), 'dd MMM yyyy')}</TableCell>
                </TableRow>
              ))}
            </TableBody></Table></div>
          )}
        </CardContent>
      </Card>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Daily Cash Book &mdash; {format(new Date(), 'dd MMMM yyyy')}</CardTitle></CardHeader>
        <CardContent><div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-green-50 dark:bg-green-900/10 p-4">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" /><span className="text-sm font-medium text-green-700 dark:text-green-300">Cash Inflow</span></div>
            <p className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-300">{formatINR(totalInflow)}</p>
            <div className="mt-2 space-y-1 text-xs text-green-600/80 dark:text-green-400/70">
              <div className="flex justify-between"><span>POS Sales</span><span className="font-medium">{formatINR(posCashToday)}</span></div>
              <div className="flex justify-between"><span>Invoice Payments</span><span className="font-medium">{formatINR(invoicePaidToday)}</span></div>
            </div></div>
          <div className="rounded-xl border bg-red-50 dark:bg-red-900/10 p-4">
            <div className="flex items-center gap-2 mb-2"><TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" /><span className="text-sm font-medium text-red-700 dark:text-red-300">Cash Outflow</span></div>
            <p className="text-2xl font-bold tabular-nums text-red-700 dark:text-red-300">{formatINR(expensesToday)}</p>
            <div className="mt-2 text-xs text-red-600/80 dark:text-red-400/70"><div className="flex justify-between"><span>Expenses</span><span className="font-medium">{formatINR(expensesToday)}</span></div></div>
          </div>
          <div className={netCash >= 0 ? "rounded-xl border p-4 bg-blue-50 dark:bg-blue-900/10" : "rounded-xl border p-4 bg-amber-50 dark:bg-amber-900/10"}>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className={netCash >= 0 ? "w-4 h-4 text-blue-600 dark:text-blue-400" : "w-4 h-4 text-amber-600 dark:text-amber-400"} />
              <span className={netCash >= 0 ? "text-sm font-medium text-blue-700 dark:text-blue-300" : "text-sm font-medium text-amber-700 dark:text-amber-300"}>Net Cash</span>
            </div>
            <p className={netCash >= 0 ? "text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-300" : "text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300"}>{formatINR(netCash)}</p>
            <div className={netCash >= 0 ? "mt-2 text-xs text-blue-600/80 dark:text-blue-400/70" : "mt-2 text-xs text-amber-600/80 dark:text-amber-400/70"}>
              <div className="flex justify-between"><span>Inflow minus Outflow</span><span className="font-medium">{netCash >= 0 ? 'Surplus' : 'Deficit'}</span></div>
            </div>
          </div>
        </div></CardContent></Card>
    </div>
  )
}

function SummaryCard({ icon, iconBg, label, value, valueClass = '' }: { icon: React.ReactNode; iconBg: string; label: string; value: string; valueClass?: string }) {
  return (<Card className="rounded-2xl border shadow-sm"><CardContent className="p-5"><div className="flex items-center gap-3">
    <div className={iconBg + " w-10 h-10 rounded-lg flex items-center justify-center shrink-0"}>{icon}</div>
    <div><p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
    <p className={(valueClass ? valueClass + " " : "") + "text-xl font-bold tabular-nums"}>{value}</p></div>
  </div></CardContent></Card>)
}
