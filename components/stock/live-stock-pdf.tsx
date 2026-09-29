// components/stock/live-stock-pdf.tsx
// NOTE: Never import this file directly in a Server Component.
// Always dynamic-import it in a click handler (see stock-export-button.tsx).
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'

const PHARMACY_NAME = 'Om Sakthi Medicals'

/** Built-in Helvetica has no ₹ glyph, so amounts use "Rs." in the PDF */
export function fmtRs(n: number): string {
  const [int, dec] = n.toFixed(2).split('.')
  const formatted = int.replace(/(\d)(?=(\d{2})*\d{3}$)/g, '$1,')
  return `Rs. ${formatted}.${dec}`
}

export interface LiveStockPdfRow {
  sno:            number
  medicine_name:  string
  company:        string
  batch_no:       string
  expiry:         string
  purchase_price: number
  sale_price:     number
  initial_qty:    number
  sold_qty:       number
  available_qty:  number
  purchase_value: number
  sale_value:     number
}

type Col = {
  header: string
  flex:   number
  align?: 'right'
  value:  (r: LiveStockPdfRow) => string
}

// flex = relative column width (landscape A4)
const COLS: Col[] = [
  { header: '#',              flex: 3,  align: 'right', value: (r) => String(r.sno) },
  { header: 'Medicine Name',  flex: 20,                 value: (r) => r.medicine_name },
  { header: 'Company',        flex: 11,                 value: (r) => r.company || '—' },
  { header: 'Batch',          flex: 8,                  value: (r) => r.batch_no },
  { header: 'Expiry',         flex: 7,                  value: (r) => r.expiry },
  { header: 'P.Price',        flex: 6,  align: 'right', value: (r) => r.purchase_price.toFixed(2) },
  { header: 'S.Price',        flex: 6,  align: 'right', value: (r) => r.sale_price.toFixed(2) },
  { header: 'Qty',            flex: 4,  align: 'right', value: (r) => String(r.initial_qty) },
  { header: 'Sold',           flex: 4,  align: 'right', value: (r) => String(r.sold_qty) },
  { header: 'Avail',          flex: 4,  align: 'right', value: (r) => String(r.available_qty) },
  { header: 'P.Value',        flex: 8,  align: 'right', value: (r) => r.purchase_value.toFixed(2) },
  { header: 'S.Value',        flex: 8,  align: 'right', value: (r) => r.sale_value.toFixed(2) },
]

const s = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 24,
    fontSize: 7.5,
    fontFamily: 'Helvetica',
    color: '#111111',
    backgroundColor: '#ffffff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  pharmacyName: { fontFamily: 'Helvetica-Bold', fontSize: 12 },
  reportTitle:  { fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#333333' },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    color: '#666666',
    fontSize: 7.5,
    marginTop: 3,
    paddingBottom: 5,
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#aaaaaa',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#166534',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 7, color: '#ffffff', paddingHorizontal: 2 },
  tr: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 0.3,
    borderBottomColor: '#dddddd',
  },
  trAlt: { backgroundColor: '#f9fafb' },
  td: { fontSize: 7.5, lineHeight: 1.25, color: '#222222', paddingHorizontal: 2 },
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: '#dcfce7',
    borderTopWidth: 0.8,
    borderTopColor: '#166534',
  },
  tdBold: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, paddingHorizontal: 2 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  summaryCard: {
    backgroundColor: '#f4f4f5',
    borderRadius: 4,
    padding: 7,
    minWidth: 115,
    marginRight: 8,
    marginBottom: 6,
  },
  summaryLabel: { fontSize: 6.5, color: '#777777', textTransform: 'uppercase', marginBottom: 2 },
  summaryValue: { fontFamily: 'Helvetica-Bold', fontSize: 9.5 },
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 24,
    right: 24,
    fontSize: 7,
    color: '#999999',
    textAlign: 'center',
  },
})

// ── Manual pagination ────────────────────────────────────────────────────────
// react-pdf's automatic page-splitting re-lays out all remaining rows at every
// page break (quadratic — thousands of batches took minutes). Instead we chunk
// rows into explicit <Page>s using a conservative height budget, so each page
// is laid out once and never overflows.
const LINE_H          = 7.5 * 1.25   // td fontSize × lineHeight
const ROW_PAD         = 6.3          // vertical padding + border
const PAGE_BODY_H     = 595 - 24 - 32 - 58   // A4 landscape − padding − header block
const TAIL_H          = 110          // total row + summary cards
const NAME_CHARS_LINE = 26           // under-estimate of chars per line → never overflow

function rowHeight(r: LiveStockPdfRow) {
  const lines = Math.min(2, Math.max(1, Math.ceil(r.medicine_name.length / NAME_CHARS_LINE)))
  return ROW_PAD + lines * LINE_H
}

function paginate(rows: LiveStockPdfRow[]): { rows: LiveStockPdfRow[]; startIdx: number }[] {
  const pages: { rows: LiveStockPdfRow[]; startIdx: number }[] = []
  let current: LiveStockPdfRow[] = []
  let used = 0
  let startIdx = 0
  rows.forEach((r, i) => {
    const h = rowHeight(r)
    if (current.length && used + h > PAGE_BODY_H) {
      pages.push({ rows: current, startIdx })
      current = []
      used = 0
      startIdx = i
    }
    current.push(r)
    used += h
  })
  pages.push({ rows: current, startIdx })
  // Totals + summary go on the last page if they fit, else on their own page
  const lastUsed = pages[pages.length - 1].rows.reduce((sum, r) => sum + rowHeight(r), 0)
  if (lastUsed + TAIL_H > PAGE_BODY_H) pages.push({ rows: [], startIdx: rows.length })
  return pages
}

interface LiveStockDocumentProps {
  title:        string
  sortLabel:    string
  rows:         LiveStockPdfRow[]
  totals:       { qty: number; purchaseValue: number; saleValue: number }
  summaryItems: { label: string; value: string }[]
}

export function LiveStockDocument({ title, sortLabel, rows, totals, summaryItems }: LiveStockDocumentProps) {
  const now = new Date()
  const generatedStr =
    now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const cellStyle = (col: Col, base: Style) =>
    [
      base,
      { flex: col.flex, maxLines: col.header === 'Medicine Name' ? 2 : 1, textOverflow: 'ellipsis' as const },
      col.align === 'right' ? { textAlign: 'right' as const } : {},
    ]

  const pages = paginate(rows)

  return (
    <Document title={title}>
      {pages.map((page, pageIdx) => {
        const isLast = pageIdx === pages.length - 1
        return (
          <Page key={pageIdx} size="A4" orientation="landscape" style={s.page} wrap={false}>
            {/* Header block — repeated on every page */}
            <View style={s.headerRow}>
              <Text style={s.pharmacyName}>{PHARMACY_NAME}</Text>
              <Text style={s.reportTitle}>{title}</Text>
            </View>
            <View style={s.metaRow}>
              <Text>Generated: {generatedStr}</Text>
              <Text>Sorted by: {sortLabel}</Text>
            </View>
            <View style={s.tableHeader}>
              {COLS.map((col) => (
                <Text key={col.header} style={cellStyle(col, s.th)}>{col.header}</Text>
              ))}
            </View>

            {page.rows.map((row, i) => (
              <View key={i} style={[s.tr, (page.startIdx + i) % 2 === 1 ? s.trAlt : {}]}>
                {COLS.map((col) => (
                  <Text key={col.header} style={cellStyle(col, s.td)}>{col.value(row)}</Text>
                ))}
              </View>
            ))}

            {isLast && (
              <>
                {/* Grand total row */}
                <View style={s.totalRow}>
                  {COLS.map((col) => {
                    let v = ''
                    if (col.header === 'Medicine Name') v = 'TOTAL'
                    else if (col.header === 'Avail')   v = String(totals.qty)
                    else if (col.header === 'P.Value') v = totals.purchaseValue.toFixed(2)
                    else if (col.header === 'S.Value') v = totals.saleValue.toFixed(2)
                    return <Text key={col.header} style={cellStyle(col, s.tdBold)}>{v}</Text>
                  })}
                </View>

                {/* Summary cards */}
                <View style={s.summaryGrid}>
                  {summaryItems.map((item) => (
                    <View key={item.label} style={s.summaryCard}>
                      <Text style={s.summaryLabel}>{item.label}</Text>
                      <Text style={s.summaryValue}>{item.value}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            <Text style={s.footer}>
              {`${PHARMACY_NAME}  ·  ${title}  ·  Page ${pageIdx + 1} of ${pages.length}`}
            </Text>
          </Page>
        )
      })}
    </Document>
  )
}
