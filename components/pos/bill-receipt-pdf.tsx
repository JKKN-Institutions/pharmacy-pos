// NOTE: This file is dynamically imported — never import it directly in a Server Component.
// @react-pdf/renderer uses browser APIs; dynamic import ensures it only loads client-side.
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { format } from 'date-fns'
import type { PosBill } from '@/lib/types/database'

export type BillItem = {
  id: string
  medicine_name: string | null
  batch_no: string
  qty: number
  sale_price: number
  price: number
}

export type PharmacyInfo = {
  store_name?: string
  store_address?: string
  store_phone?: string
  store_gstin?: string
  store_dl?: string
  invoice_footer?: string
}

/** INR formatter safe for react-pdf — uses "Rs." because built-in Helvetica
 *  doesn't include the ₹ glyph (U+20B9).
 *  Indian grouping: last 3 digits, then every 2 digits. E.g. 1,23,456.78 */
function fmtINR(n: number) {
  const [int, dec] = n.toFixed(2).split('.')
  // Indian grouping: first group of 3 from right, then groups of 2
  let lastThree = int.slice(-3)
  const rest = int.slice(0, -3)
  if (rest) {
    lastThree = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
  }
  return `Rs. ${lastThree}.${dec}`
}

const BORDER = '#d1d5db'
const MUTED = '#6b7280'
const PRIMARY = '#16a34a'

const s = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  storeName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 18,
    color: PRIMARY,
    marginBottom: 2,
  },
  storeDetail: {
    fontSize: 8,
    color: MUTED,
    lineHeight: 1.4,
  },
  billTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    textAlign: 'right',
    marginBottom: 4,
  },
  billNoText: {
    fontSize: 10,
    textAlign: 'right',
    color: MUTED,
  },
  // Meta section
  metaContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    marginBottom: 16,
  },
  metaCell: {
    flex: 1,
    padding: 8,
  },
  metaCellBorder: {
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  metaLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  metaSubValue: {
    fontSize: 8,
    color: MUTED,
    marginTop: 1,
  },
  // Table
  table: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
  },
  tableRowAlt: {
    backgroundColor: '#f9fafb',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  thText: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tdText: {
    fontSize: 9,
  },
  tdBold: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  tdMuted: {
    fontSize: 8,
    color: MUTED,
    fontFamily: 'Helvetica',
  },
  // Column widths
  colSno:      { width: '6%' },
  colMedicine: { width: '34%' },
  colBatch:    { width: '12%' },
  colQty:      { width: '10%', textAlign: 'right' as const },
  colPrice:    { width: '18%', textAlign: 'right' as const },
  colTotal:    { width: '20%', textAlign: 'right' as const },
  // Totals
  totalsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  totalsBox: {
    width: '45%',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
  },
  totalsLabel: {
    fontSize: 9,
    color: MUTED,
  },
  totalsValue: {
    fontSize: 9,
  },
  totalsFinalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  totalsFinalLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  totalsFinalValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: PRIMARY,
  },
  // Footer
  footer: {
    textAlign: 'center',
    fontSize: 8,
    color: MUTED,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
  },
  // Status badge
  statusBadge: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: PRIMARY,
    backgroundColor: '#dcfce7',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    textTransform: 'uppercase',
  },
  cancelledBadge: {
    color: '#dc2626',
    backgroundColor: '#fef2f2',
  },
})

interface Props {
  bill: PosBill
  items: BillItem[]
  pharmacy: PharmacyInfo
}

export function BillReceiptDocument({ bill, items, pharmacy }: Props) {
  const isCancelled = bill.status === 'cancelled'

  return (
    <Document title={bill.bill_no}>
      <Page size="A4" style={s.page}>

        {/* ── Header: Store info + Bill title ── */}
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.storeName}>
              {pharmacy.store_name || 'Pharmacy'}
            </Text>
            {pharmacy.store_address ? (
              <Text style={s.storeDetail}>{pharmacy.store_address}</Text>
            ) : null}
            {pharmacy.store_phone ? (
              <Text style={s.storeDetail}>Ph: {pharmacy.store_phone}</Text>
            ) : null}
            {pharmacy.store_gstin ? (
              <Text style={s.storeDetail}>GSTIN: {pharmacy.store_gstin}</Text>
            ) : null}
            {pharmacy.store_dl ? (
              <Text style={s.storeDetail}>DL No: {pharmacy.store_dl}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.billTitle}>CASH MEMO</Text>
            <Text style={s.billNoText}>{bill.bill_no}</Text>
            <Text style={[s.billNoText, { marginTop: 2 }]}>
              {format(new Date(bill.bill_date), 'dd MMM yyyy, hh:mm a')}
            </Text>
            <View style={{ marginTop: 6 }}>
              <Text style={[s.statusBadge, isCancelled ? s.cancelledBadge : {}]}>
                {bill.status}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Meta: Customer, Payment, Doctor ── */}
        <View style={s.metaContainer}>
          <View style={[s.metaCell, s.metaCellBorder]}>
            <Text style={s.metaLabel}>Customer</Text>
            <Text style={s.metaValue}>{bill.customer_name ?? 'Walk-in'}</Text>
            {bill.customer_phone ? (
              <Text style={s.metaSubValue}>{bill.customer_phone}</Text>
            ) : null}
          </View>
          <View style={[s.metaCell, s.metaCellBorder]}>
            <Text style={s.metaLabel}>Payment Method</Text>
            <Text style={[s.metaValue, { textTransform: 'capitalize' }]}>
              {bill.payment_method}
            </Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>{bill.doctor ? 'Doctor' : 'Items'}</Text>
            <Text style={s.metaValue}>
              {bill.doctor ?? `${items.length} items`}
            </Text>
          </View>
        </View>

        {/* ── Cancellation notice ── */}
        {isCancelled && bill.cancel_reason ? (
          <View style={{
            borderWidth: 1,
            borderColor: '#fca5a5',
            backgroundColor: '#fef2f2',
            borderRadius: 4,
            padding: 8,
            marginBottom: 16,
          }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#dc2626', textTransform: 'uppercase', marginBottom: 2 }}>
              Cancelled{bill.cancelled_at ? ` on ${format(new Date(bill.cancelled_at), 'dd MMM yyyy, hh:mm a')}` : ''}
            </Text>
            <Text style={{ fontSize: 9, color: '#991b1b' }}>{bill.cancel_reason}</Text>
          </View>
        ) : null}

        {/* ── Items Table ── */}
        <View style={s.table}>
          {/* Header */}
          <View style={s.tableHeader}>
            <Text style={[s.thText, s.colSno]}>#</Text>
            <Text style={[s.thText, s.colMedicine]}>Medicine</Text>
            <Text style={[s.thText, s.colBatch]}>Batch</Text>
            <Text style={[s.thText, s.colQty]}>Qty</Text>
            <Text style={[s.thText, s.colPrice]}>Price</Text>
            <Text style={[s.thText, s.colTotal]}>Total</Text>
          </View>

          {/* Rows */}
          {items.map((item, i) => (
            <View
              key={item.id}
              style={[
                s.tableRow,
                i % 2 === 1 ? s.tableRowAlt : {},
                i === items.length - 1 ? s.tableRowLast : {},
              ]}
            >
              <Text style={[s.tdMuted, s.colSno]}>{i + 1}</Text>
              <Text style={[s.tdBold, s.colMedicine]}>{item.medicine_name ?? '—'}</Text>
              <Text style={[s.tdMuted, s.colBatch]}>{item.batch_no}</Text>
              <Text style={[s.tdText, s.colQty]}>{item.qty}</Text>
              <Text style={[s.tdText, s.colPrice]}>{fmtINR(item.sale_price)}</Text>
              <Text style={[s.tdBold, s.colTotal]}>{fmtINR(item.price)}</Text>
            </View>
          ))}
        </View>

        {/* ── Totals ── */}
        <View style={s.totalsContainer}>
          <View style={s.totalsBox}>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Subtotal</Text>
              <Text style={s.totalsValue}>{fmtINR(bill.subtotal)}</Text>
            </View>
            {bill.discount_total > 0 ? (
              <View style={s.totalsRow}>
                <Text style={s.totalsLabel}>Discount</Text>
                <Text style={[s.totalsValue, { color: '#dc2626' }]}>- {fmtINR(bill.discount_total)}</Text>
              </View>
            ) : null}
            {bill.tax_total > 0 ? (
              <View style={s.totalsRow}>
                <Text style={s.totalsLabel}>Tax</Text>
                <Text style={s.totalsValue}>+ {fmtINR(bill.tax_total)}</Text>
              </View>
            ) : null}
            <View style={s.totalsFinalRow}>
              <Text style={s.totalsFinalLabel}>Total</Text>
              <Text style={s.totalsFinalValue}>{fmtINR(bill.total)}</Text>
            </View>
          </View>
        </View>

        {/* ── Note ── */}
        {bill.note ? (
          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 8, color: MUTED }}>Note: {bill.note}</Text>
          </View>
        ) : null}

        {/* ── Footer ── */}
        <Text style={s.footer}>
          {pharmacy.invoice_footer || 'Thank you for your purchase!'}
        </Text>

      </Page>
    </Document>
  )
}
