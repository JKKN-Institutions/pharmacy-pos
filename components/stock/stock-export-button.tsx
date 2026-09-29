'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Download, Loader2, CalendarClock, ArrowDownAZ } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatINR } from '@/lib/utils/currency'
import type { ReportColumn } from '@/lib/utils/export-report-excel'
import type { LiveStockPdfRow } from '@/components/stock/live-stock-pdf'
import { fetchLiveStockForExportAction } from '@/app/(dashboard)/stock/actions'

const EXCEL_COLUMNS: ReportColumn[] = [
  { header: 'S.No',           key: 'sno',            width: 7,  align: 'right' },
  { header: 'Medicine Name',  key: 'medicine_name',  width: 38 },
  { header: 'Company',        key: 'company',        width: 24 },
  { header: 'Batch No',       key: 'batch_no',       width: 16 },
  { header: 'Expiry',         key: 'expiry',         width: 13 },
  { header: 'Purchase Price', key: 'purchase_price', width: 15, align: 'right' },
  { header: 'Sale Price',     key: 'sale_price',     width: 13, align: 'right' },
  { header: 'Qty',            key: 'initial_qty',    width: 9,  align: 'right' },
  { header: 'Sold',           key: 'sold_qty',       width: 9,  align: 'right' },
  { header: 'Available',      key: 'available_qty',  width: 11, align: 'right' },
  { header: 'Purchase Value', key: 'purchase_value', width: 16, align: 'right' },
  { header: 'Sale Value',     key: 'sale_value',     width: 14, align: 'right' },
]

const round2 = (n: number) => Math.round(n * 100) / 100

type SortMode   = 'expiry' | 'name'
type FileFormat = 'excel' | 'pdf'

/** Fetches all live stock and shapes it into export rows + totals (shared by Excel & PDF). */
async function buildLiveStockExport(sortBy: SortMode) {
  const { rows, error } = await fetchLiveStockForExportAction(sortBy)
  if (error) throw new Error(error)

  const totals = { qty: 0, purchaseValue: 0, saleValue: 0 }
  const medicines = new Set<string>()

  const exportRows: LiveStockPdfRow[] = rows.map((r, i) => {
    const purchaseValue = round2(r.purchase_price * r.available_qty)
    const saleValue     = round2(r.sale_price * r.available_qty)
    totals.qty           += r.available_qty
    totals.purchaseValue += purchaseValue
    totals.saleValue     += saleValue
    medicines.add(r.medicine_name.toLowerCase())
    return {
      sno:            i + 1,
      medicine_name:  r.medicine_name,
      company:        r.company,
      batch_no:       r.batch_no,
      expiry:         format(new Date(r.expiry_date), 'dd-MM-yyyy'),
      purchase_price: r.purchase_price,
      sale_price:     r.sale_price,
      initial_qty:    r.initial_qty,
      sold_qty:       r.sold_qty,
      available_qty:  r.available_qty,
      purchase_value: purchaseValue,
      sale_value:     saleValue,
    }
  })
  totals.purchaseValue = round2(totals.purchaseValue)
  totals.saleValue     = round2(totals.saleValue)

  const isAlpha = sortBy === 'name'
  const today   = format(new Date(), 'yyyy-MM-dd')

  return {
    rows:           exportRows,
    totals,
    uniqueMedicines: medicines.size,
    title:          isAlpha ? 'Live Stock (A–Z)' : 'Live Stock (by Expiry)',
    sortLabel:      isAlpha ? 'Medicine name (A–Z)' : 'Expiry date (nearest first)',
    filename:       isAlpha ? `live-stock-a-z-${today}` : `live-stock-${today}`,
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function StockExportButton() {
  const [loading, setLoading] = useState<FileFormat | null>(null)

  async function handleExport(fileFormat: FileFormat, sortBy: SortMode) {
    setLoading(fileFormat)
    try {
      const data = await buildLiveStockExport(sortBy)
      if (!data.rows.length) { toast.info('No live stock to export'); return }

      const count = data.rows.length.toLocaleString('en-IN')

      if (fileFormat === 'excel') {
        const { exportReportExcel } = await import('@/lib/utils/export-report-excel')
        await exportReportExcel({
          title:    data.title,
          filename: data.filename,
          columns:  EXCEL_COLUMNS,
          rows:     data.rows as unknown as Record<string, unknown>[],
          summaryItems: [
            { label: 'Sort Order',             value: data.sortLabel },
            { label: 'Total Batches',          value: count },
            { label: 'Unique Medicines',       value: data.uniqueMedicines.toLocaleString('en-IN') },
            { label: 'Total Available Qty',    value: data.totals.qty.toLocaleString('en-IN') },
            { label: 'Stock Value (Purchase)', value: formatINR(data.totals.purchaseValue) },
            { label: 'Stock Value (Sale)',     value: formatINR(data.totals.saleValue) },
          ],
        })
      } else {
        const [{ pdf }, { LiveStockDocument, fmtRs }] = await Promise.all([
          import('@react-pdf/renderer'),
          import('@/components/stock/live-stock-pdf'),
        ])
        const blob = await pdf(
          <LiveStockDocument
            title={data.title}
            sortLabel={data.sortLabel}
            rows={data.rows}
            totals={data.totals}
            summaryItems={[
              { label: 'Total Batches',          value: count },
              { label: 'Unique Medicines',       value: data.uniqueMedicines.toLocaleString('en-IN') },
              { label: 'Total Available Qty',    value: data.totals.qty.toLocaleString('en-IN') },
              { label: 'Stock Value (Purchase)', value: fmtRs(data.totals.purchaseValue) },
              { label: 'Stock Value (Sale)',     value: fmtRs(data.totals.saleValue) },
            ]}
          />,
        ).toBlob()
        downloadBlob(blob, `${data.filename}.pdf`)
      }

      toast.success(`Exported ${count} live stock batches`)
    } catch (err) {
      toast.error(
        err instanceof Error && err.message === 'Not authenticated'
          ? 'Session expired. Please log in again.'
          : `Failed to export ${fileFormat === 'pdf' ? 'PDF' : 'Excel'}. Please try again.`,
      )
    } finally {
      setLoading(null)
    }
  }

  const item = (fileFormat: FileFormat, sortBy: SortMode) => (
    <DropdownMenuItem onSelect={() => handleExport(fileFormat, sortBy)} className="gap-2 cursor-pointer">
      {sortBy === 'expiry' ? <CalendarClock className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
      {sortBy === 'expiry' ? 'Live Stock (by Expiry)' : 'Live Stock (A–Z)'}
    </DropdownMenuItem>
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2" disabled={loading !== null}>
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Download className="h-4 w-4" />}
          {loading === 'pdf' ? 'Generating PDF…' : loading ? 'Exporting…' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
          Excel (.xlsx)
        </DropdownMenuLabel>
        {item('excel', 'expiry')}
        {item('excel', 'name')}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
          PDF (A4 landscape)
        </DropdownMenuLabel>
        {item('pdf', 'expiry')}
        {item('pdf', 'name')}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
