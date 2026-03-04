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
  ss.getColumn(1).width = 30
  ss.getColumn(2).width = 24

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
