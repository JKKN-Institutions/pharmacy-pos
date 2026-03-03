/**
 * Parses the "Purchase Pharmacy Management" CSV/Excel export.
 *
 * CSV columns:
 *   "#", "Supplier Name", "Sub Total", "Tax", "Discount", "Amount", "Purchase Date", ""
 *
 * Important: This file contains purchase HEADERS only (summary totals per purchase).
 * There are no line-item columns (medicine, batch, qty, price).
 * Imported records will have totals but NO purchase_items or stock_batches.
 */
import * as XLSX from 'xlsx'

export interface ParsedPurchaseRow {
  supplier_name: string   // Raw name — resolved to supplier_id in the Server Action
  subtotal: number
  tax: number
  discount: number
  total: number           // May be auto-corrected (subtotal + tax − discount)
  original_total?: number // Original value from file when auto-correction happened
  purchase_date: string   // ISO format: YYYY-MM-DD (empty string if unparseable)
  raw_row: number         // Original sheet row index (for error messages)
  errors: string[]        // Validation errors — empty means row is importable
  warnings: string[]      // Non-blocking notices (e.g. auto-corrected total)
  isValid: boolean
}

/** Strip ₹, commas, and whitespace then parse as float. Returns NaN on failure. */
function parseCurrency(value: string | null | undefined): number {
  if (!value) return NaN
  const cleaned = String(value).replace(/[₹,\s]/g, '').trim()
  return parseFloat(cleaned)
}

/**
 * Convert DD/MM/YYYY → YYYY-MM-DD (ISO).
 * Returns empty string if the value cannot be parsed.
 */
function parseDate(value: string | null | undefined): string {
  if (!value) return ''
  const s = String(value).trim()

  // DD/MM/YYYY
  const parts = s.split('/')
  if (parts.length === 3) {
    const [d, m, y] = parts
    if (d && m && y && y.length === 4) {
      const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
      const dt = new Date(iso)
      if (!isNaN(dt.getTime())) return iso
    }
  }

  // Fallback: try native Date parse (handles ISO, etc.)
  const dt = new Date(s)
  if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0]

  return ''
}

/** Run validation rules. Returns error messages for blocking issues only. */
function validateRow(row: Omit<ParsedPurchaseRow, 'errors' | 'warnings' | 'isValid'>): string[] {
  const errs: string[] = []

  if (!row.supplier_name || row.supplier_name.trim().length < 2) {
    errs.push('Supplier name is required (min 2 characters)')
  }

  if (!row.purchase_date) {
    errs.push('Purchase date is required — use DD/MM/YYYY format')
  } else {
    const dt = new Date(row.purchase_date)
    if (isNaN(dt.getTime())) {
      errs.push(`Invalid date "${row.purchase_date}"`)
    } else if (dt.getFullYear() < 2000 || dt.getFullYear() > 2100) {
      errs.push(`Date year ${dt.getFullYear()} looks incorrect`)
    }
  }

  if (isNaN(row.total) || row.total <= 0) {
    errs.push('Amount (total) must be a positive number')
  }

  if (!isNaN(row.subtotal) && row.subtotal < 0) {
    errs.push('Sub total cannot be negative')
  }

  if (!isNaN(row.tax) && row.tax < 0) {
    errs.push('Tax cannot be negative')
  }

  if (!isNaN(row.discount) && row.discount < 0) {
    errs.push('Discount cannot be negative')
  }

  return errs
}

/**
 * Parses an uploaded .xlsx / .xls / .csv file into structured purchase rows.
 *
 * ALL rows (including invalid ones) are returned so the preview can highlight
 * problems. Only rows where `isValid === true` should be sent to the server action.
 *
 * When the "Amount" column in the file does NOT match (subtotal + tax − discount),
 * the total is AUTO-CORRECTED to the formula value and a warning is added to the row.
 * The row remains valid and will be imported with the corrected total.
 */
export function parsePurchasesFile(
  buffer: ArrayBuffer,
  filename: string,
): ParsedPurchaseRow[] {
  const lname = filename.toLowerCase()
  let rows: Array<Record<string, unknown>>

  if (lname.endsWith('.csv')) {
    // ── CSV path ──────────────────────────────────────────────────────────────
    const text = new TextDecoder().decode(buffer)
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) return []

    function parseCsvLine(line: string): string[] {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          inQuotes = !inQuotes
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += ch
        }
      }
      result.push(current.trim())
      return result
    }

    const headers = parseCsvLine(lines[0]).map((h) =>
      h.replace(/^"|"$/g, '').trim(),
    )
    rows = lines
      .slice(1)
      .map((line) => {
        const cols = parseCsvLine(line).map((v) => v.replace(/^"|"$/g, '').trim())
        return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? '']))
      })
      .filter((r) => Object.values(r).some((v) => v !== ''))
  } else {
    // ── Excel path (.xlsx / .xls) ─────────────────────────────────────────────
    const wb = XLSX.read(buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]

    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: null,
    })

    let headerRowIdx = 0
    for (let i = 0; i < Math.min(5, rawRows.length); i++) {
      const row = rawRows[i] as unknown[]
      if (
        row?.some((cell) =>
          String(cell ?? '')
            .toLowerCase()
            .includes('supplier'),
        )
      ) {
        headerRowIdx = i
        break
      }
    }

    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      range: headerRowIdx,
    })
  }

  // ── Normalize + validate each row (all rows included, even invalid) ─────────
  const result: ParsedPurchaseRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    // Lowercase all keys for case-insensitive lookup
    const r: Record<string, string | null> = {}
    for (const [k, v] of Object.entries(row)) {
      const key = k.toLowerCase().trim()
      r[key] = v != null && String(v).trim() ? String(v).trim() : null
    }

    // Skip completely empty rows silently
    const allEmpty = Object.values(r).every((v) => !v)
    if (allEmpty) continue

    const supplier_name = (
      r['supplier name'] ?? r['suppliername'] ?? r['supplier'] ?? ''
    ).trim()

    const subtotal = parseCurrency(
      r['sub total'] ?? r['subtotal'] ?? r['sub_total'] ?? '',
    )
    const tax      = parseCurrency(r['tax'] ?? '')
    const discount = parseCurrency(r['discount'] ?? '')
    const rawTotal = parseCurrency(
      r['amount'] ?? r['total'] ?? r['grand total'] ?? '',
    )
    const purchase_date = parseDate(
      r['purchase date'] ?? r['purchasedate'] ?? r['date'] ?? '',
    )

    // ── Auto-correct total using the standard formula ─────────────────────────
    // Correct formula: total = subtotal + tax − discount
    // If the file's Amount column does not match (within ₹1.50 rounding tolerance),
    // auto-correct it and record a warning so the user knows what changed.
    const TOLERANCE = 1.5
    let total = isNaN(rawTotal) ? 0 : rawTotal
    let original_total: number | undefined
    const warnings: string[] = []

    if (
      !isNaN(subtotal) && subtotal >= 0 &&
      !isNaN(tax)      && tax >= 0 &&
      !isNaN(discount) && discount >= 0 &&
      !isNaN(rawTotal) && rawTotal > 0
    ) {
      const corrected = Math.max(0, subtotal + tax - discount)
      if (Math.abs(rawTotal - corrected) > TOLERANCE) {
        original_total = rawTotal
        total = corrected
        warnings.push(
          `Amount corrected: file had ₹${rawTotal.toFixed(2)}, ` +
          `recalculated as ₹${subtotal.toFixed(2)} + ₹${tax.toFixed(2)} − ₹${discount.toFixed(2)} = ₹${corrected.toFixed(2)}`,
        )
      }
    }

    const partial: Omit<ParsedPurchaseRow, 'errors' | 'warnings' | 'isValid'> = {
      supplier_name,
      subtotal:  isNaN(subtotal)  ? 0 : subtotal,
      tax:       isNaN(tax)       ? 0 : tax,
      discount:  isNaN(discount)  ? 0 : discount,
      total,
      original_total,
      purchase_date,
      raw_row: i + 1,
    }

    const errors = validateRow(partial)

    result.push({ ...partial, errors, warnings, isValid: errors.length === 0 })
  }

  return result
}
