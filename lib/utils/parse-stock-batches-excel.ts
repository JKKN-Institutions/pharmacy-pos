import * as XLSX from 'xlsx'

export interface ParsedStockBatchRow {
  medicine_name: string
  batch_number:  string
  expiry_date:   string   // normalized to YYYY-MM-DD
  purchase_price: number
  selling_price:  number
  mrp:            number
  qty:            number
  raw_row:        number
}

export interface ParseStockResult {
  rows:            ParsedStockBatchRow[]
  detectedHeaders: string[]   // raw header strings as they appear in the file
}

/**
 * Normalises common date formats to YYYY-MM-DD.
 * Handles: DD/MM/YYYY, DD-MM-YYYY, MM/YYYY (last day of month), YYYY-MM-DD.
 */
function parseExpiryDate(raw: string | null): string | null {
  if (!raw) return null
  const s = raw.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  const dmy = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const my = s.match(/^(\d{1,2})[/\-](\d{4})$/)
  if (my) {
    const [, m, y] = my
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate()
    return `${y}-${m.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  }

  const serial = parseInt(s, 10)
  if (!isNaN(serial) && serial > 40000 && serial < 60000) {
    const d = XLSX.SSF.parse_date_code(serial)
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
    }
  }

  return null
}

/**
 * Strips currency symbols, commas and whitespace then parses as float.
 * Handles: "₹42.50", "Rs.42.50", "1,234.00", "42.50 ", etc.
 */
function cleanNumber(raw: string | null | undefined): number {
  if (!raw) return 0
  const cleaned = String(raw).replace(/[₹$€£\s,]/g, '').replace(/^Rs\.?/i, '')
  return parseFloat(cleaned) || 0
}

/**
 * Given a raw header key, returns all normalized forms we store it under so
 * lookups are case/dot/space insensitive.
 * e.g. "Pur. Rate" → ["pur. rate", "pur rate", "purrate"]
 */
function normalizedForms(key: string): string[] {
  const base        = key.toLowerCase().trim()
  const dotsAsSpace = base.replace(/\./g, ' ').replace(/\s+/g, ' ').trim()
  const nodots      = base.replace(/[.\s]/g, '')
  return [...new Set([base, dotsAsSpace, nodots])]
}

/**
 * Parses an uploaded .xlsx / .xls / .csv file into structured stock batch rows.
 * Also returns the raw header strings detected in the file for debugging.
 */
export function parseStockBatchesFile(
  buffer:   ArrayBuffer,
  filename: string,
): ParseStockResult {
  const lname = filename.toLowerCase()
  let rows:            Array<Record<string, unknown>>
  let detectedHeaders: string[] = []

  if (lname.endsWith('.csv')) {
    const text  = new TextDecoder().decode(buffer)
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) return { rows: [], detectedHeaders: [] }

    detectedHeaders = lines[0].split(',').map((h) => h.trim())
    rows = lines
      .slice(1)
      .map((line) => {
        const cols = line.split(',').map((v) => v.trim())
        return Object.fromEntries(detectedHeaders.map((h, i) => [h, cols[i] ?? '']))
      })
      .filter((r) => Object.values(r).some((v) => v !== ''))

  } else {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
    const ws = wb.Sheets[wb.SheetNames[0]]

    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: null,
    })

    // Locate the header row — look for "Medicine" or "Name" in first 5 rows
    let headerRowIdx = 0
    for (let i = 0; i < Math.min(5, rawRows.length); i++) {
      const row = rawRows[i] as unknown[]
      if (
        row?.some((cell) => {
          const s = String(cell ?? '').toLowerCase().trim()
          return s === 'medicine' || s === 'name' || s === 'medicine name'
        })
      ) {
        headerRowIdx = i
        break
      }
    }

    // Capture raw headers from the located header row
    const headerRow = rawRows[headerRowIdx] as unknown[]
    detectedHeaders = (headerRow ?? [])
      .map((c) => String(c ?? '').trim())
      .filter(Boolean)

    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      range:  headerRowIdx,
    })
  }

  const result: ParsedStockBatchRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    // Build a lookup map storing every key under all its normalized forms
    const r: Record<string, string | null> = {}
    for (const [k, v] of Object.entries(row)) {
      const value = v != null && String(v).trim() ? String(v).trim() : null
      for (const form of normalizedForms(k)) {
        r[form] = value
      }
    }

    // ── Medicine name ─────────────────────────────────────────────────────────
    const medicine_name =
      r['medicine'] ?? r['medicine name'] ?? r['medicinename'] ??
      r['name']     ?? r['drug']          ?? r['drug name']    ?? ''
    if (!medicine_name || medicine_name.length < 2) continue

    // ── Batch number ──────────────────────────────────────────────────────────
    const batch_number =
      r['batch']    ?? r['batch number'] ?? r['batchnumber'] ??
      r['batch no'] ?? r['batchno']      ?? r['lot no']      ??
      r['lot number'] ?? ''
    if (!batch_number) continue

    // ── Expiry date ───────────────────────────────────────────────────────────
    const expiryRaw =
      r['expiry']      ?? r['expiry date'] ?? r['expirydate'] ??
      r['exp']         ?? r['exp date']    ?? r['expdate']    ??
      r['exp dt']      ?? r['expdt']       ?? ''
    const expiry_date = parseExpiryDate(expiryRaw)
    if (!expiry_date) continue

    // ── Purchase price ────────────────────────────────────────────────────────
    const purchase_price = cleanNumber(
      r['purchase rate']   ?? r['purchaserate']   ??
      r['pur rate']        ?? r['purrate']         ??
      r['p rate']          ?? r['prate']           ??
      r['purchase price']  ?? r['purchaseprice']   ??
      r['cost price']      ?? r['costprice']       ??
      r['cost rate']       ?? r['costrate']        ??
      r['unit cost']       ?? r['unitcost']        ??
      r['cost']            ?? r['cp'],
    )

    // ── Sale / selling price ──────────────────────────────────────────────────
    const selling_price = cleanNumber(
      r['sale rate']       ?? r['salerate']        ??
      r['sal rate']        ?? r['salrate']         ??
      r['s rate']          ?? r['srate']           ??
      r['sale price']      ?? r['saleprice']       ??
      r['selling price']   ?? r['sellingprice']    ??
      r['selling rate']    ?? r['sellingrate']     ??
      r['sell rate']       ?? r['sellrate']        ??
      r['retail price']    ?? r['retailprice']     ??
      r['unit price']      ?? r['unitprice']       ??
      r['sp']              ?? r['mrp'],
    )

    // ── MRP (optional) ────────────────────────────────────────────────────────
    const mrpRaw =
      r['mrp'] ?? r['max retail price'] ?? r['maxretailprice'] ??
      r['max price'] ?? r['maxprice'] ?? null
    const mrp = mrpRaw ? (cleanNumber(mrpRaw) || selling_price) : selling_price

    // ── Quantity ──────────────────────────────────────────────────────────────
    const qty =
      parseInt(
        r['qty']           ?? r['quantity']       ??
        r['stock']         ?? r['stock qty']      ??
        r['stockqty']      ?? r['opening stock']  ??
        r['openingstock']  ?? r['opening qty']    ??
        r['openingqty']    ?? r['available qty']  ??
        r['availableqty']  ?? r['available']      ?? '0',
        10,
      ) || 0
    if (qty <= 0) continue

    result.push({
      medicine_name,
      batch_number,
      expiry_date,
      purchase_price,
      selling_price,
      mrp,
      qty,
      raw_row: i + 1,
    })
  }

  return { rows: result, detectedHeaders }
}
