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
    marginBottom: 14,
  },
  summaryCard: {
    backgroundColor: '#f4f4f5',
    borderRadius: 4,
    padding: 8,
    minWidth: 120,
    marginRight: 8,
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
        {rows.length === 0 ? (
          <View style={{ padding: 14 }}>
            <Text style={{ color: '#888888', fontSize: 9, textAlign: 'center' }}>
              No data available for the selected period.
            </Text>
          </View>
        ) : rows.map((row, rowIdx) => (
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
        <View style={s.footer} fixed>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${PHARMACY_NAME}  ·  ${title}  ·  Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}
