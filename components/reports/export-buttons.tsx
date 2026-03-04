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
