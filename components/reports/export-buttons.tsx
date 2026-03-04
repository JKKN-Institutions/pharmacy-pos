'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, FileDown, Sheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
    let objectUrl: string | null = null
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
      objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = `${filename}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
    } catch {
      toast.error('Failed to generate PDF. Please try again.')
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setPdfLoading(false)
    }
  }

  async function handleExcel() {
    setXlsxLoading(true)
    try {
      const { exportReportExcel } = await import('@/lib/utils/export-report-excel')
      await exportReportExcel({ title, filename, columns, rows, summaryItems })
    } catch {
      toast.error('Failed to export Excel. Please try again.')
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
        {pdfLoading
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <FileDown className="w-4 h-4" />}
        <span className="hidden sm:inline ml-1">{pdfLoading ? 'Generating…' : 'PDF'}</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExcel}
        disabled={xlsxLoading}
        title="Export Excel"
      >
        {xlsxLoading
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Sheet className="w-4 h-4" />}
        <span className="hidden sm:inline ml-1">{xlsxLoading ? 'Exporting…' : 'Excel'}</span>
      </Button>
    </div>
  )
}
