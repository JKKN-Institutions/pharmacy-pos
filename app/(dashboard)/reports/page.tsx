import { PageHeader } from '@/components/ui/page-header'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import {
  ShoppingCart, FileText, ClipboardList, Archive,
  AlertTriangle, DollarSign, Receipt, BookOpen, BarChart3
} from 'lucide-react'

const reports = [
  { href: '/reports/pos-bill', title: 'POS / Bill Report', description: 'All counter sales with payment details', icon: ShoppingCart, color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
  { href: '/reports/invoice', title: 'Invoice Report', description: 'Credit invoices with payment status', icon: FileText, color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
  { href: '/reports/purchase', title: 'Purchase Report', description: 'Stock purchases from suppliers', icon: ClipboardList, color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30' },
  { href: '/reports/inventory', title: 'Inventory Report', description: 'Current stock batches and values', icon: Archive, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
  { href: '/reports/out-of-stock', title: 'Out of Stock', description: 'Medicines below reorder level', icon: AlertTriangle, color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
  { href: '/reports/expenses', title: 'Expenses Report', description: 'Categorized operational expenses', icon: DollarSign, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
  { href: '/reports/salary', title: 'Salary Report', description: 'Staff salary payment records', icon: Receipt, color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30' },
  { href: '/reports/account', title: 'Account Report', description: 'Customer credit ledger and payments', icon: BookOpen, color: 'text-teal-600 bg-teal-100 dark:bg-teal-900/30' },
  { href: '/reports/income-expense', title: 'Income & Expense', description: 'Net profit / loss summary', icon: BarChart3, color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
]

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Business analytics and financial reports" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map(report => (
          <Link key={report.href} href={report.href}>
            <Card className="rounded-2xl hover:shadow-md transition-shadow cursor-pointer border hover:border-primary/30">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${report.color}`}>
                    <report.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{report.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{report.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
