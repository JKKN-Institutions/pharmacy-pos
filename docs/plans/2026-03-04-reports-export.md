# Reports Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Print / Download PDF / Export Excel buttons to all 9 report pages via three shared building blocks — no new DB queries, all export data comes from props already fetched by Server Components.

**Architecture:** `exportReportExcel` utility (ExcelJS, dynamic import) + `ReportDocument` generic PDF component (@react-pdf/renderer, dynamic import in click handler) + `ExportButtons` client component (Printer/FileDown/Sheet buttons in PageHeader). Print uses `window.print()` + Tailwind `print:hidden` classes on layout elements. Server Components flatten nested objects (e.g. `suppliers?.name`) into plain strings before passing rows to ExportButtons.

**Tech Stack:** ExcelJS (already in package.json via generate-medicines-template), @react-pdf/renderer v4 (already installed), lucide-react (Printer, FileDown, Sheet icons), shadcn/ui Button, Tailwind v4 `print:` variant.

---

### Task 1: Create `lib/utils/export-report-excel.ts`

**Files:**
- Create: `lib/utils/export-report-excel.ts`

**Step 1: Write the file**

```ts
// lib/utils/export-report-excel.ts
// Dynamic import keeps exceljs (~1MB) out of the initial JS bundle.

export interface ReportColumn {
  header: string
  key: string
  width?: number
  align?: 'left' | 'right' | 'center'
}

export interface ExportExcelOptions {
  title: string
  filename: string   // no extension
  columns: ReportColumn[]
  rows: Record<string, unknown>[]
  summaryItems: { label: string; value: string }[]
}

export async function exportReportExcel(options: ExportExcelOptions): Promise<void> {
  const { title, filename, columns, rows, summaryItems } = options
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()

  // ── Sheet 1: Data ──────────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Data')

  ws.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width ?? 18,
  }))

  // Header row style — dark green fill, white bold text, center-aligned
  ws.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false }
  })

  // Data rows
  for (const row of rows) {
    const values: Record<string, unknown> = {}
    for (const col of columns) {
      values[col.key] = row[col.key] ?? ''
    }
    const addedRow = ws.addRow(values)

    // Right-align numeric columns
    columns.forEach((col, idx) => {
      if (col.align === 'right') {
        addedRow.getCell(idx + 1).alignment = { horizontal: 'right' }
      }
    })
  }

  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  // ── Sheet 2: Summary ───────────────────────────────────────────────────────
  const ss = wb.addWorksheet('Summary')
  ss.columns = [
    { header: 'Label', key: 'label', width: 30 },
    { header: 'Value', key: 'value', width: 24 },
  ]

  // Title row
  ss.addRow([title])
  ss.getRow(1).font = { bold: true, size: 13 }

  // Generated date row
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  ss.addRow([`Generated: ${dateStr} ${timeStr}`])
  ss.getRow(2).font = { color: { argb: 'FF666666' }, size: 10 }

  ss.addRow([]) // blank separator

  // Summary items
  for (const item of summaryItems) {
    const r = ss.addRow([item.label, item.value])
    r.getCell(1).font = { bold: true }
    r.getCell(2).alignment = { horizontal: 'right' }
  }

  // ── Browser download ───────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${filename}.xlsx`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
```

**Step 2: Verify no TypeScript errors**

Run: `bun run build 2>&1 | grep export-report-excel`
Expected: no errors (or clean build output for that file)

**Step 3: Commit**

```bash
git add lib/utils/export-report-excel.ts
git commit -m "feat(reports): add exportReportExcel utility (ExcelJS, dynamic import)"
```

---

### Task 2: Create `components/reports/report-pdf.tsx`

**Files:**
- Create: `components/reports/report-pdf.tsx`

**Step 1: Write the file**

```tsx
// components/reports/report-pdf.tsx
// NOTE: Never import this file directly in a Server Component.
// Always dynamic-import it in a click handler or use 'use client' wrapper.
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer'
import type { ReportColumn } from '@/lib/utils/export-report-excel'

/** INR formatter safe for @react-pdf/renderer (no Intl.NumberFormat) */
function fmtINR(n: number | string): string {
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (isNaN(num)) return String(n)
  const [int, dec] = num.toFixed(2).split('.')
  const formatted = int.replace(/(\d)(?=(\d{2})+$)/g, '$1,')
  return `\u20B9${formatted}.${dec}`
}

const PHARMACY_NAME = 'Om Sakthi Medicals'

const s = StyleSheet.create({
  page: {
    paddingVertical: 28,
    paddingHorizontal: 32,
    fontSize: 8.5,
    fontFamily: 'Helvetica',
    color: '#111111',
    backgroundColor: '#ffffff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  pharmacyName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    color: '#111111',
  },
  reportTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#333333',
    textAlign: 'right',
  },
  hr: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#aaaaaa',
    marginVertical: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    color: '#666666',
    fontSize: 8,
    marginBottom: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  summaryCard: {
    backgroundColor: '#f4f4f5',
    borderRadius: 4,
    padding: 8,
    minWidth: 120,
  },
  summaryLabel: {
    fontSize: 7,
    color: '#777777',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  summaryValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#111111',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#166534',
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginBottom: 0,
  },
  tableHeaderCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: '#ffffff',
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.3,
    borderBottomColor: '#dddddd',
  },
  tableRowAlt: {
    backgroundColor: '#f9fafb',
  },
  tableCell: {
    fontSize: 8,
    color: '#222222',
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#999999',
  },
})

interface ReportDocumentProps {
  title: string
  columns: ReportColumn[]
  rows: Record<string, unknown>[]
  summaryItems: { label: string; value: string }[]
  dateRange?: { from?: string; to?: string }
}

export function ReportDocument({
  title,
  columns,
  rows,
  summaryItems,
  dateRange,
}: ReportDocumentProps) {
  const now = new Date()
  const generatedStr = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) + ' ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const dateRangeStr =
    dateRange?.from || dateRange?.to
      ? `Period: ${dateRange?.from ?? '—'} to ${dateRange?.to ?? '—'}`
      : ''

  return (
    <Document title={title}>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <Text style={s.pharmacyName}>{PHARMACY_NAME}</Text>
          <Text style={s.reportTitle}>{title}</Text>
        </View>

        <View style={s.hr} />

        {/* Meta row */}
        <View style={s.metaRow}>
          <Text>Generated: {generatedStr}</Text>
          {dateRangeStr ? <Text>{dateRangeStr}</Text> : <Text />}
        </View>

        {/* Summary cards */}
        {summaryItems.length > 0 && (
          <View style={s.summaryGrid}>
            {summaryItems.map((item, i) => (
              <View key={i} style={s.summaryCard}>
                <Text style={s.summaryLabel}>{item.label}</Text>
                <Text style={s.summaryValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Data table header */}
        <View style={s.tableHeader}>
          {columns.map((col, i) => (
            <Text
              key={i}
              style={[
                s.tableHeaderCell,
                col.align === 'right' ? { textAlign: 'right' } : {},
              ]}
            >
              {col.header}
            </Text>
          ))}
        </View>

        {/* Data rows */}
        {rows.map((row, rowIdx) => (
          <View
            key={rowIdx}
            style={[s.tableRow, rowIdx % 2 === 1 ? s.tableRowAlt : {}]}
          >
            {columns.map((col, colIdx) => {
              const raw = row[col.key]
              const isRight = col.align === 'right'
              return (
                <Text
                  key={colIdx}
                  style={[s.tableCell, isRight ? { textAlign: 'right' } : {}]}
                >
                  {raw == null ? '—' : String(raw)}
                </Text>
              )
            })}
          </View>
        ))}

        {/* Footer with page numbers */}
        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) =>
            `${PHARMACY_NAME}  ·  ${title}  ·  Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}
```

**Step 2: Commit**

```bash
git add components/reports/report-pdf.tsx
git commit -m "feat(reports): add generic ReportDocument for @react-pdf/renderer"
```

---

### Task 3: Create `components/reports/export-buttons.tsx`

**Files:**
- Create: `components/reports/export-buttons.tsx`

**Step 1: Write the file**

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, FileDown, Sheet } from 'lucide-react'
import type { ReportColumn } from '@/lib/utils/export-report-excel'

interface ExportButtonsProps {
  title: string
  filename: string                              // no extension
  columns: ReportColumn[]
  rows: Record<string, unknown>[]
  summaryItems: { label: string; value: string }[]
  dateRange?: { from?: string; to?: string }
}

export function ExportButtons({
  title,
  filename,
  columns,
  rows,
  summaryItems,
  dateRange,
}: ExportButtonsProps) {
  const [pdfLoading, setPdfLoading] = useState(false)
  const [xlsxLoading, setXlsxLoading] = useState(false)

  function handlePrint() {
    window.print()
  }

  async function handlePdf() {
    setPdfLoading(true)
    try {
      const [{ pdf }, { ReportDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/reports/report-pdf'),
      ])
      const blob = await pdf(
        <ReportDocument
          title={title}
          columns={columns}
          rows={rows}
          summaryItems={summaryItems}
          dateRange={dateRange}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${filename}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } finally {
      setPdfLoading(false)
    }
  }

  async function handleExcel() {
    setXlsxLoading(true)
    try {
      const { exportReportExcel } = await import('@/lib/utils/export-report-excel')
      await exportReportExcel({ title, filename, columns, rows, summaryItems })
    } finally {
      setXlsxLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1 print:hidden">
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrint}
        title="Print"
      >
        <Printer className="w-4 h-4" />
        <span className="hidden sm:inline ml-1">Print</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handlePdf}
        disabled={pdfLoading}
        title="Download PDF"
      >
        <FileDown className="w-4 h-4" />
        <span className="hidden sm:inline ml-1">{pdfLoading ? 'Generating…' : 'PDF'}</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExcel}
        disabled={xlsxLoading}
        title="Export Excel"
      >
        <Sheet className="w-4 h-4" />
        <span className="hidden sm:inline ml-1">{xlsxLoading ? 'Exporting…' : 'Excel'}</span>
      </Button>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/reports/export-buttons.tsx
git commit -m "feat(reports): add ExportButtons client component (Print/PDF/Excel)"
```

---

### Task 4: Add print:hidden CSS to layout and DataTable

**Files:**
- Modify: `components/layout/dashboard-shell.tsx`
- Modify: `components/ui/data-table.tsx`

**Step 1: Edit `components/layout/dashboard-shell.tsx`**

Current:
```tsx
<SidebarProvider defaultOpen={true}>
  {/* Sidebar only on desktop (lg+) — mobile/tablet uses bottom nav */}
  <div className="hidden lg:block">
    <AppSidebar userRole={profile.role} />
  </div>
  <SidebarInset className="h-svh overflow-hidden">
    <Topbar user={profile} />
    {/* pb-20 adds space for the bottom nav on mobile; lg:pb-6 resets on desktop */}
    <div className="flex flex-1 flex-col gap-4 p-3 sm:p-6 overflow-y-auto pb-20 lg:pb-6 bg-muted/30 dark:bg-background">
      {/* PWA banners — shown inline at the top of the content area */}
      <UpdatePrompt />
      <InstallPrompt />
      {children}
    </div>
  </SidebarInset>
  {/* Mobile bottom navigation — hidden on lg+ screens */}
  <BottomNavbar userRole={profile.role} />
</SidebarProvider>
```

Change to:
```tsx
<SidebarProvider defaultOpen={true}>
  {/* Sidebar only on desktop (lg+) — mobile/tablet uses bottom nav */}
  <div className="hidden lg:block print:hidden">
    <AppSidebar userRole={profile.role} />
  </div>
  <SidebarInset className="h-svh overflow-hidden print:h-auto print:overflow-visible">
    <div className="print:hidden">
      <Topbar user={profile} />
    </div>
    {/* pb-20 adds space for the bottom nav on mobile; lg:pb-6 resets on desktop */}
    <div className="flex flex-1 flex-col gap-4 p-3 sm:p-6 overflow-y-auto pb-20 lg:pb-6 bg-muted/30 dark:bg-background print:overflow-visible print:p-0 print:pb-0 print:bg-white dark:print:bg-white">
      {/* PWA banners — shown inline at the top of the content area */}
      <div className="print:hidden">
        <UpdatePrompt />
        <InstallPrompt />
      </div>
      {children}
    </div>
  </SidebarInset>
  {/* Mobile bottom navigation — hidden on lg+ screens */}
  <div className="print:hidden">
    <BottomNavbar userRole={profile.role} />
  </div>
</SidebarProvider>
```

**Step 2: Edit `components/ui/data-table.tsx`**

Find the search input wrapper div:
```tsx
{searchKey && (
  <div className="relative max-w-sm">
```
Change to:
```tsx
{searchKey && (
  <div className="relative max-w-sm print:hidden">
```

Find the pagination wrapper div:
```tsx
<div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
```
Change to:
```tsx
<div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 print:hidden">
```

**Step 3: Commit**

```bash
git add components/layout/dashboard-shell.tsx components/ui/data-table.tsx
git commit -m "feat(reports): add print:hidden CSS to layout elements and DataTable controls"
```

---

### Task 5: Update `app/(dashboard)/reports/pos-bill/page.tsx`

**Files:**
- Modify: `app/(dashboard)/reports/pos-bill/page.tsx`

**Step 1: Add ExportButtons**

Add import at the top:
```tsx
import { ExportButtons } from '@/components/reports/export-buttons'
```

In the Server Component body, after computing `totalRevenue`, add the export config:
```tsx
const exportColumns = [
  { header: 'Bill No',       key: 'bill_no',         width: 16 },
  { header: 'Date',          key: 'bill_date',        width: 14 },
  { header: 'Customer',      key: 'customer_name',    width: 22 },
  { header: 'Doctor',        key: 'doctor',           width: 20 },
  { header: 'Payment',       key: 'payment_method',   width: 14 },
  { header: 'Subtotal',      key: 'subtotal',         width: 14, align: 'right' as const },
  { header: 'Discount',      key: 'discount_total',   width: 12, align: 'right' as const },
  { header: 'Tax',           key: 'tax_total',        width: 10, align: 'right' as const },
  { header: 'Total (₹)',     key: 'total',            width: 14, align: 'right' as const },
]
const exportRows = (bills ?? []).map((b) => ({
  bill_no:          b.bill_no,
  bill_date:        b.bill_date,
  customer_name:    b.customer_name ?? '—',
  doctor:           b.doctor ?? '—',
  payment_method:   b.payment_method,
  subtotal:         Number(b.subtotal).toFixed(2),
  discount_total:   Number(b.discount_total).toFixed(2),
  tax_total:        Number(b.tax_total).toFixed(2),
  total:            Number(b.total).toFixed(2),
}))
const exportSummary = [
  { label: 'Total Revenue', value: formatINR(totalRevenue) },
  { label: 'Bill Count',    value: String(count ?? 0) },
]
const today = new Date().toISOString().slice(0, 10)
```

In the PageHeader JSX, add ExportButtons before the existing Button:
```tsx
<PageHeader title="POS / Bill Report" description={`${count ?? 0} bills · Total: ${formatINR(totalRevenue)}`}>
  <ExportButtons
    title="POS / Bill Report"
    filename={`pos-bill-${today}`}
    columns={exportColumns}
    rows={exportRows}
    summaryItems={exportSummary}
    dateRange={params}
  />
  <Button variant="outline" size="sm" asChild>
    <Link href="/reports"><ChevronLeft className="w-4 h-4 mr-1" />Reports</Link>
  </Button>
</PageHeader>
```

**Step 2: Commit**

```bash
git add app/(dashboard)/reports/pos-bill/page.tsx
git commit -m "feat(reports): add ExportButtons to POS/Bill report"
```

---

### Task 6: Update `app/(dashboard)/reports/purchase/page.tsx`

**Files:**
- Modify: `app/(dashboard)/reports/purchase/page.tsx`

**Step 1: Add ExportButtons**

Add import:
```tsx
import { ExportButtons } from '@/components/reports/export-buttons'
```

After computing `totalCost`, add:
```tsx
const exportColumns = [
  { header: 'Invoice No',  key: 'invoice_no',    width: 16 },
  { header: 'Date',        key: 'purchase_date', width: 14 },
  { header: 'Supplier',    key: 'supplier_name', width: 24 },
  { header: 'Total (₹)',   key: 'total',         width: 14, align: 'right' as const },
  { header: 'Status',      key: 'status',        width: 14 },
]
const exportRows = rows.map((r) => ({
  invoice_no:    r.invoice_no,
  purchase_date: r.purchase_date,
  supplier_name: r.suppliers?.name ?? '—',
  total:         Number(r.total).toFixed(2),
  status:        r.status,
}))
const exportSummary = [
  { label: 'Total Purchase Cost', value: formatINR(totalCost) },
  { label: 'Total Purchases',     value: String(count ?? 0) },
  { label: 'Avg. Purchase Value', value: count ? formatINR(totalCost / count) : formatINR(0) },
]
const today = new Date().toISOString().slice(0, 10)
```

In PageHeader:
```tsx
<PageHeader title="Purchase Report" description={`${count ?? 0} purchases`}>
  <ExportButtons
    title="Purchase Report"
    filename={`purchase-${today}`}
    columns={exportColumns}
    rows={exportRows}
    summaryItems={exportSummary}
    dateRange={{ from: params.from, to: params.to }}
  />
  <Button variant="outline" size="sm" asChild>
    <Link href="/reports"><ChevronLeft className="w-4 h-4 mr-1" />Reports</Link>
  </Button>
</PageHeader>
```

**Step 2: Commit**

```bash
git add app/(dashboard)/reports/purchase/page.tsx
git commit -m "feat(reports): add ExportButtons to Purchase report"
```

---

### Task 7: Update `app/(dashboard)/reports/invoice/page.tsx`

**Files:**
- Modify: `app/(dashboard)/reports/invoice/page.tsx`

**Step 1: Add ExportButtons**

Add import:
```tsx
import { ExportButtons } from '@/components/reports/export-buttons'
```

After computing `totalOutstanding`, add:
```tsx
const exportColumns = [
  { header: 'Invoice No',  key: 'invoice_no',     width: 16 },
  { header: 'Date',        key: 'invoice_date',   width: 14 },
  { header: 'Due Date',    key: 'due_date',        width: 14 },
  { header: 'Customer',    key: 'customer_name',  width: 22 },
  { header: 'Phone',       key: 'customer_phone', width: 14 },
  { header: 'Total (₹)',   key: 'total',          width: 14, align: 'right' as const },
  { header: 'Paid (₹)',    key: 'paid',           width: 14, align: 'right' as const },
  { header: 'Due (₹)',     key: 'due',            width: 14, align: 'right' as const },
  { header: 'Status',      key: 'payment_status', width: 12 },
]
const exportRows = rows.map((r) => ({
  invoice_no:     r.invoice_no,
  invoice_date:   r.invoice_date,
  due_date:       r.due_date ?? '—',
  customer_name:  r.customer_name,
  customer_phone: r.customer_phone ?? '—',
  total:          Number(r.total).toFixed(2),
  paid:           Number(r.paid).toFixed(2),
  due:            Number(r.due).toFixed(2),
  payment_status: r.payment_status,
}))
const exportSummary = [
  { label: 'Total Revenue',     value: formatINR(totalRevenue) },
  { label: 'Total Collected',   value: formatINR(totalCollected) },
  { label: 'Total Outstanding', value: formatINR(totalOutstanding) },
  { label: 'Invoice Count',     value: String(count ?? 0) },
]
const today = new Date().toISOString().slice(0, 10)
```

In PageHeader:
```tsx
<PageHeader title="Invoice Report" description={`${count ?? 0} invoices`}>
  <ExportButtons
    title="Invoice Report"
    filename={`invoice-${today}`}
    columns={exportColumns}
    rows={exportRows}
    summaryItems={exportSummary}
    dateRange={{ from: params.from, to: params.to }}
  />
  <Button variant="outline" size="sm" asChild>
    <Link href="/reports"><ChevronLeft className="w-4 h-4 mr-1" />Reports</Link>
  </Button>
</PageHeader>
```

**Step 2: Commit**

```bash
git add app/(dashboard)/reports/invoice/page.tsx
git commit -m "feat(reports): add ExportButtons to Invoice report"
```

---

### Task 8: Update `app/(dashboard)/reports/expenses/page.tsx`

**Files:**
- Modify: `app/(dashboard)/reports/expenses/page.tsx`

**Step 1: Add ExportButtons**

Add import:
```tsx
import { ExportButtons } from '@/components/reports/export-buttons'
```

After computing `byType`, add:
```tsx
const exportColumns = [
  { header: 'Date',        key: 'date',         width: 14 },
  { header: 'Name',        key: 'name',         width: 24 },
  { header: 'Type',        key: 'expense_type', width: 18 },
  { header: 'Method',      key: 'method',       width: 14 },
  { header: 'Amount (₹)',  key: 'amount',       width: 14, align: 'right' as const },
  { header: 'Description', key: 'description',  width: 30 },
]
const exportRows = rows.map((r) => ({
  date:         r.date,
  name:         r.name,
  expense_type: r.expense_type,
  method:       r.method,
  amount:       Number(r.amount).toFixed(2),
  description:  r.description ?? '—',
}))
const exportSummary = [
  { label: 'Total Expenses',     value: formatINR(totalExpenses) },
  { label: 'Record Count',       value: String(count ?? 0) },
  { label: 'Expense Categories', value: String(Object.keys(byType).length) },
]
const today = new Date().toISOString().slice(0, 10)
```

In PageHeader:
```tsx
<PageHeader title="Expenses Report" description={`${count ?? 0} expense records`}>
  <ExportButtons
    title="Expenses Report"
    filename={`expenses-${today}`}
    columns={exportColumns}
    rows={exportRows}
    summaryItems={exportSummary}
    dateRange={{ from: params.from, to: params.to }}
  />
  <Button variant="outline" size="sm" asChild>
    <Link href="/reports"><ChevronLeft className="w-4 h-4 mr-1" />Reports</Link>
  </Button>
</PageHeader>
```

**Step 2: Commit**

```bash
git add app/(dashboard)/reports/expenses/page.tsx
git commit -m "feat(reports): add ExportButtons to Expenses report"
```

---

### Task 9: Update `app/(dashboard)/reports/salary/page.tsx`

**Files:**
- Modify: `app/(dashboard)/reports/salary/page.tsx`

**Step 1: Add ExportButtons**

Add import:
```tsx
import { ExportButtons } from '@/components/reports/export-buttons'
```

After computing `byStaff`, add:
```tsx
const exportColumns = [
  { header: 'Date',       key: 'date',       width: 14 },
  { header: 'Staff Name', key: 'staff_name', width: 22 },
  { header: 'Amount (₹)', key: 'amount',     width: 14, align: 'right' as const },
  { header: 'Method',     key: 'method',     width: 14 },
  { header: 'Note',       key: 'note',       width: 30 },
]
const exportRows = rows.map((r) => ({
  date:       r.date,
  staff_name: r.staff_name,
  amount:     Number(r.amount).toFixed(2),
  method:     r.method,
  note:       r.note ?? '—',
}))
const exportSummary = [
  { label: 'Total Salary Paid', value: formatINR(totalSalary) },
  { label: 'Staff Members',     value: String(uniqueStaff) },
  { label: 'Payment Records',   value: String(count ?? 0) },
]
const today = new Date().toISOString().slice(0, 10)
```

In PageHeader:
```tsx
<PageHeader title="Salary Report" description={`${count ?? 0} salary payment records`}>
  <ExportButtons
    title="Salary Report"
    filename={`salary-${today}`}
    columns={exportColumns}
    rows={exportRows}
    summaryItems={exportSummary}
    dateRange={{ from: params.from, to: params.to }}
  />
  <Button variant="outline" size="sm" asChild>
    <Link href="/reports"><ChevronLeft className="w-4 h-4 mr-1" />Reports</Link>
  </Button>
</PageHeader>
```

**Step 2: Commit**

```bash
git add app/(dashboard)/reports/salary/page.tsx
git commit -m "feat(reports): add ExportButtons to Salary report"
```

---

### Task 10: Update `app/(dashboard)/reports/inventory/page.tsx`

**Files:**
- Modify: `app/(dashboard)/reports/inventory/page.tsx`

**Step 1: Add imports**

```tsx
import { ExportButtons } from '@/components/reports/export-buttons'
```

**Step 2: Add export config after computing `totalUnits`**

```tsx
const exportColumns = [
  { header: 'Medicine',        key: 'medicine_name',   width: 32 },
  { header: 'Batch No',        key: 'batch_no',        width: 16 },
  { header: 'Expiry Date',     key: 'expiry_date',     width: 14 },
  { header: 'Qty',             key: 'available_qty',   width: 10, align: 'right' as const },
  { header: 'Purchase (₹)',    key: 'purchase_price',  width: 14, align: 'right' as const },
  { header: 'Selling (₹)',     key: 'sale_price',      width: 14, align: 'right' as const },
  { header: 'Stock Value (₹)', key: 'stock_value',     width: 16, align: 'right' as const },
]
const exportRows = rows.map((r) => ({
  medicine_name:  r.medicines?.name ?? '—',
  batch_no:       r.batch_no,
  expiry_date:    r.expiry_date,
  available_qty:  Number(r.available_qty),
  purchase_price: Number(r.purchase_price).toFixed(2),
  sale_price:     Number(r.sale_price).toFixed(2),
  stock_value:    (Number(r.available_qty) * Number(r.purchase_price)).toFixed(2),
}))
const exportSummary = [
  { label: 'Total Stock Value',  value: formatINR(totalStockValue) },
  { label: 'Total Units',        value: totalUnits.toLocaleString('en-IN') },
  { label: 'Active Batches',     value: String(rows.length) },
]
const today = new Date().toISOString().slice(0, 10)
```

**Step 3: Add ExportButtons to PageHeader**

```tsx
<PageHeader title="Inventory Report" description={`${rows.length} active stock batches`}>
  <ExportButtons
    title="Inventory Report"
    filename={`inventory-${today}`}
    columns={exportColumns}
    rows={exportRows}
    summaryItems={exportSummary}
  />
  <Button variant="outline" size="sm" asChild>
    <Link href="/reports"><ChevronLeft className="w-4 h-4 mr-1" />Reports</Link>
  </Button>
</PageHeader>
```

**Step 4: Commit**

```bash
git add app/(dashboard)/reports/inventory/page.tsx
git commit -m "feat(reports): add ExportButtons to Inventory report"
```

---

### Task 11: Update `app/(dashboard)/reports/account/page.tsx`

**Files:**
- Modify: `app/(dashboard)/reports/account/page.tsx`

**Step 1: Add import**

```tsx
import { ExportButtons } from '@/components/reports/export-buttons'
```

**Step 2: Add export config after computing `grandTotalOutstanding`**

```tsx
const exportColumns = [
  { header: 'Customer',       key: 'customer_name',     width: 24 },
  { header: 'Phone',          key: 'customer_phone',    width: 14 },
  { header: 'Invoices',       key: 'invoice_count',     width: 10, align: 'right' as const },
  { header: 'Invoiced (₹)',   key: 'total_invoiced',    width: 16, align: 'right' as const },
  { header: 'Paid (₹)',       key: 'total_paid',        width: 14, align: 'right' as const },
  { header: 'Outstanding (₹)',key: 'total_outstanding', width: 16, align: 'right' as const },
]
const exportRows = ledger.map((r) => ({
  customer_name:     r.customer_name,
  customer_phone:    r.customer_phone ?? '—',
  invoice_count:     r.invoice_count,
  total_invoiced:    Number(r.total_invoiced).toFixed(2),
  total_paid:        Number(r.total_paid).toFixed(2),
  total_outstanding: Number(r.total_outstanding).toFixed(2),
}))
const exportSummary = [
  { label: 'Total Invoiced (Unpaid)', value: formatINR(grandTotalInvoiced) },
  { label: 'Total Collected',         value: formatINR(grandTotalPaid) },
  { label: 'Total Outstanding',       value: formatINR(grandTotalOutstanding) },
  { label: 'Customers with Dues',     value: String(ledger.length) },
]
const today = new Date().toISOString().slice(0, 10)
```

**Step 3: Add ExportButtons to PageHeader**

```tsx
<PageHeader title="Account Report" description={`Customer credit ledger - ${ledger.length} customers with outstanding dues`}>
  <ExportButtons
    title="Account Report"
    filename={`account-${today}`}
    columns={exportColumns}
    rows={exportRows}
    summaryItems={exportSummary}
  />
  <Button variant="outline" size="sm" asChild>
    <Link href="/reports"><ChevronLeft className="w-4 h-4 mr-1" />Reports</Link>
  </Button>
</PageHeader>
```

**Step 4: Commit**

```bash
git add app/(dashboard)/reports/account/page.tsx
git commit -m "feat(reports): add ExportButtons to Account report"
```

---

### Task 12: Update `app/(dashboard)/reports/out-of-stock/page.tsx`

**Files:**
- Modify: `app/(dashboard)/reports/out-of-stock/page.tsx`

**Step 1: Add imports**

```tsx
import { ExportButtons } from '@/components/reports/export-buttons'
```

**Step 2: Add export config after computing `lowStock`**

```tsx
const outOfStockCount = lowStock.filter(m => m.available === 0).length
const lowStockCount = lowStock.filter(m => m.available > 0).length
const exportColumns = [
  { header: 'Medicine',      key: 'name',          width: 32 },
  { header: 'Company',       key: 'company',       width: 20 },
  { header: 'Available',     key: 'available',     width: 12, align: 'right' as const },
  { header: 'Reorder Level', key: 'reorder_level', width: 14, align: 'right' as const },
  { header: 'Status',        key: 'status',        width: 14 },
]
const exportRows = lowStock.map((m) => ({
  name:          m.name,
  company:       m.company ?? '—',
  available:     m.available,
  reorder_level: m.reorder_level,
  status:        m.available === 0 ? 'Out of Stock' : 'Low Stock',
}))
const exportSummary = [
  { label: 'Out of Stock',    value: String(outOfStockCount) },
  { label: 'Low Stock',       value: String(lowStockCount) },
  { label: 'Total Attention', value: String(lowStock.length) },
]
const today = new Date().toISOString().slice(0, 10)
```

**Step 3: Add ExportButtons to PageHeader**

```tsx
<PageHeader title="Out of Stock Report" description={`${lowStock.length} medicines at or below reorder level`}>
  <ExportButtons
    title="Out of Stock Report"
    filename={`out-of-stock-${today}`}
    columns={exportColumns}
    rows={exportRows}
    summaryItems={exportSummary}
  />
  <Button variant="outline" size="sm" asChild>
    <Link href="/reports"><ChevronLeft className="w-4 h-4 mr-1" />Reports</Link>
  </Button>
</PageHeader>
```

**Step 4: Commit**

```bash
git add app/(dashboard)/reports/out-of-stock/page.tsx
git commit -m "feat(reports): add ExportButtons to Out of Stock report"
```

---

### Task 13: Update `app/(dashboard)/reports/income-expense/page.tsx`

**Files:**
- Modify: `app/(dashboard)/reports/income-expense/page.tsx`

**Step 1: Add import**

```tsx
import { ExportButtons } from '@/components/reports/export-buttons'
```

**Step 2: Add export config after computing `totalNet`**

```tsx
const exportColumns = [
  { header: 'Month',        key: 'month',    width: 16 },
  { header: 'Income (₹)',   key: 'income',   width: 16, align: 'right' as const },
  { header: 'Expenses (₹)', key: 'expenses', width: 16, align: 'right' as const },
  { header: 'Net (₹)',      key: 'net',      width: 16, align: 'right' as const },
]
const exportRows = chartData.map((r) => ({
  month:    r.month,
  income:   Number(r.income).toFixed(2),
  expenses: Number(r.expenses).toFixed(2),
  net:      Number(r.net).toFixed(2),
}))
const exportSummary = [
  { label: 'Total Income',       value: formatINR(totalIncome) },
  { label: 'Total Expenses',     value: formatINR(totalExpenses) },
  { label: 'Net Profit / Loss',  value: formatINR(totalNet) },
]
const today = new Date().toISOString().slice(0, 10)
```

**Step 3: Add ExportButtons to PageHeader**

Note: PDF exports the monthly table only (chart cannot render in @react-pdf/renderer).

```tsx
<PageHeader title="Income & Expense Report" description="Monthly profit and loss summary">
  <ExportButtons
    title="Income & Expense Report"
    filename={`income-expense-${today}`}
    columns={exportColumns}
    rows={exportRows}
    summaryItems={exportSummary}
    dateRange={{ from: params.from, to: params.to }}
  />
  <Button variant="outline" size="sm" asChild>
    <Link href="/reports"><ChevronLeft className="w-4 h-4 mr-1" />Reports</Link>
  </Button>
</PageHeader>
```

**Step 4: Commit**

```bash
git add app/(dashboard)/reports/income-expense/page.tsx
git commit -m "feat(reports): add ExportButtons to Income & Expense report"
```

---

### Task 14: Final verification

**Step 1: Run a full build to catch TypeScript errors**

```bash
bun run build 2>&1 | tail -30
```
Expected: `✓ Compiled successfully` with no type errors.

**Step 2: Manual smoke test checklist**

Open each report in the browser and verify:
- [ ] Three export buttons (Print / PDF / Excel) appear in PageHeader
- [ ] Print button: `Ctrl+P` opens print dialog; sidebar/topbar/bottom nav hidden, table visible
- [ ] PDF button: clicks generate a `.pdf` download with correct filename, pharmacy header, summary cards, data table
- [ ] Excel button: clicks generate a `.xlsx` with Sheet 1 (green header, data rows) and Sheet 2 (summary)
- [ ] Buttons are hidden when printing (do not appear on the printed page)

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(reports): complete export feature — all 9 report pages with Print/PDF/Excel"
```
