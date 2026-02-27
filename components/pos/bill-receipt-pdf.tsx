// NOTE: This file is dynamically imported — never import it directly in a Server Component.
// @react-pdf/renderer uses browser APIs; dynamic import ensures it only loads client-side.
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { format } from 'date-fns'
import type { PosBill } from '@/lib/types/database'

export type BillItem = {
  id: string
  batch_no: string
  qty: number
  sale_price: number
  price: number
  medicines: { name: string } | null
}

export type PharmacyInfo = {
  store_name?: string
  store_address?: string
  store_phone?: string
  store_gstin?: string
  store_dl?: string
  invoice_footer?: string
}

/** INR formatter safe for react-pdf (no Intl.NumberFormat needed) */
function fmtINR(n: number) {
  const [int, dec] = n.toFixed(2).split('.')
  const formatted = int.replace(/(\d)(?=(\d{2})+$)/g, '$1,')
  return `\u20B9${formatted}.${dec}`
}

const styles = StyleSheet.create({
  page: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#111111',
    backgroundColor: '#ffffff',
  },
  center: { textAlign: 'center' },
  bold: { fontFamily: 'Helvetica-Bold' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  hr: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#aaaaaa',
    marginVertical: 6,
  },
  label: { color: '#666666' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: '#aaaaaa',
  },
})

interface Props {
  bill: PosBill
  items: BillItem[]
  pharmacy: PharmacyInfo
}

export function BillReceiptDocument({ bill, items, pharmacy }: Props) {
  // Dynamic height: base + per-item space so content never overflows
  const pageHeight = Math.max(480, 280 + items.length * 26)

  return (
    <Document title={bill.bill_no}>
      {/* 227pt ≈ 80 mm — standard thermal receipt width */}
      <Page size={[227, pageHeight]} style={styles.page}>

        {/* ── Pharmacy header ── */}
        <View style={{ marginBottom: 4 }}>
          <Text style={[styles.center, styles.bold, { fontSize: 13 }]}>
            {pharmacy.store_name || 'Pharmacy'}
          </Text>
          {pharmacy.store_address ? (
            <Text style={[styles.center, { fontSize: 8, color: '#555555', marginTop: 2 }]}>
              {pharmacy.store_address}
            </Text>
          ) : null}
          {pharmacy.store_phone ? (
            <Text style={[styles.center, { fontSize: 8, color: '#555555' }]}>
              Ph: {pharmacy.store_phone}
            </Text>
          ) : null}
          {pharmacy.store_gstin ? (
            <Text style={[styles.center, { fontSize: 8, color: '#555555' }]}>
              GSTIN: {pharmacy.store_gstin}
            </Text>
          ) : null}
          {pharmacy.store_dl ? (
            <Text style={[styles.center, { fontSize: 8, color: '#555555' }]}>
              DL No: {pharmacy.store_dl}
            </Text>
          ) : null}
        </View>

        <View style={styles.hr} />
        <Text style={[styles.center, styles.bold, { fontSize: 10, marginBottom: 6 }]}>
          CASH MEMO
        </Text>

        {/* ── Bill meta ── */}
        <View style={styles.row}>
          <Text style={styles.label}>Bill No.</Text>
          <Text style={styles.bold}>{bill.bill_no}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          <Text>{format(new Date(bill.bill_date), 'dd/MM/yyyy')}</Text>
        </View>
        {bill.customer_name ? (
          <View style={styles.row}>
            <Text style={styles.label}>Customer</Text>
            <Text>{bill.customer_name}</Text>
          </View>
        ) : null}
        {bill.customer_phone ? (
          <View style={styles.row}>
            <Text style={styles.label}>Phone</Text>
            <Text>{bill.customer_phone}</Text>
          </View>
        ) : null}
        {bill.doctor ? (
          <View style={styles.row}>
            <Text style={styles.label}>Doctor</Text>
            <Text>{bill.doctor}</Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <Text style={styles.label}>Payment</Text>
          <Text style={{ textTransform: 'uppercase' }}>{bill.payment_method}</Text>
        </View>

        <View style={styles.hr} />

        {/* ── Items header ── */}
        <View style={[styles.row, { marginBottom: 3 }]}>
          <Text style={[styles.bold, { flex: 2.5, fontSize: 8 }]}>Medicine</Text>
          <Text style={[styles.bold, { flex: 0.7, textAlign: 'right', fontSize: 8 }]}>Qty</Text>
          <Text style={[styles.bold, { flex: 1.3, textAlign: 'right', fontSize: 8 }]}>Rate</Text>
          <Text style={[styles.bold, { flex: 1.5, textAlign: 'right', fontSize: 8 }]}>Amt</Text>
        </View>

        {/* ── Line items ── */}
        {items.map((item) => (
          <View key={item.id} style={{ marginBottom: 5 }}>
            <View style={styles.row}>
              <Text style={{ flex: 2.5 }}>{item.medicines?.name ?? '—'}</Text>
              <Text style={{ flex: 0.7, textAlign: 'right' }}>{item.qty}</Text>
              <Text style={{ flex: 1.3, textAlign: 'right' }}>{fmtINR(item.sale_price)}</Text>
              <Text style={{ flex: 1.5, textAlign: 'right' }}>{fmtINR(item.price)}</Text>
            </View>
            <Text style={{ fontSize: 7, color: '#999999' }}>Batch: {item.batch_no}</Text>
          </View>
        ))}

        <View style={styles.hr} />

        {/* ── Totals ── */}
        <View style={styles.row}>
          <Text style={styles.label}>Subtotal</Text>
          <Text>{fmtINR(bill.subtotal)}</Text>
        </View>
        {bill.discount_total > 0 ? (
          <View style={styles.row}>
            <Text style={styles.label}>Discount</Text>
            <Text>- {fmtINR(bill.discount_total)}</Text>
          </View>
        ) : null}
        {bill.tax_total > 0 ? (
          <View style={styles.row}>
            <Text style={styles.label}>Tax</Text>
            <Text>+ {fmtINR(bill.tax_total)}</Text>
          </View>
        ) : null}
        <View style={styles.totalRow}>
          <Text>TOTAL</Text>
          <Text>{fmtINR(bill.total)}</Text>
        </View>

        {/* ── Footer ── */}
        <View style={[styles.hr, { marginTop: 10 }]} />
        <Text style={[styles.center, { fontSize: 8, color: '#666666', marginTop: 4 }]}>
          {pharmacy.invoice_footer || 'Thank you for your purchase!'}
        </Text>
        {bill.note ? (
          <Text style={[styles.center, { fontSize: 8, color: '#888888', marginTop: 2 }]}>
            Note: {bill.note}
          </Text>
        ) : null}

      </Page>
    </Document>
  )
}
