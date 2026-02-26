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
  total: number
  purchase_date: string   // ISO format: YYYY-MM-DD (empty string if unparseable)
  raw_row: number         // Original sheet row index (for error messages)
  errors: string[]        // Validation error messages — empty means the row is valid
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

/** Run all validation rules against a parsed row. Returns an array of error messages. */
function validateRow(row: Omit<ParsedPurchaseRow, 'errors' | 'isValid'>): string[] {
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

  // Cross-check math: subtotal + tax - discount should ≈ total (allow ₹1 rounding)
  if (
    !isNaN(row.subtotal) &&
    !isNaN(row.tax) &&
    !isNaN(row.discount) &&
    !isNaN(row.total)
  ) {
    const computed = row.subtotal + row.tax - row.discount
    if (Math.abs(computed - row.total) > 1.5) {
      errs.push(
        `Total mismatch: ${row.subtotal.toFixed(2)} + ${row.tax.toFixed(2)} − ${row.discount.toFixed(2)} = ${computed.toFixed(2)}, but Amount = ${row.total.toFixed(2)}`,
      )
    }
  }

  return errs
}

/**
 * Parses an uploaded .xlsx / .xls / .csv file into structured purchase rows.
 *
 * ALL rows (including invalid ones) are returned so the preview can highlight
 * problems. Only rows where `isValid === true` should be sent to the server action.
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
    const tax = parseCurrency(r['tax'] ?? '')
    const discount = parseCurrency(r['discount'] ?? '')
    const total = parseCurrency(
      r['amount'] ?? r['total'] ?? r['grand total'] ?? '',
    )
    const purchase_date = parseDate(
      r['purchase date'] ?? r['purchasedate'] ?? r['date'] ?? '',
    )

    const partial: Omit<ParsedPurchaseRow, 'errors' | 'isValid'> = {
      supplier_name,
      subtotal: isNaN(subtotal) ? 0 : subtotal,
      tax: isNaN(tax) ? 0 : tax,
      discount: isNaN(discount) ? 0 : discount,
      total: isNaN(total) ? 0 : total,
      purchase_date,
      raw_row: i + 1,
    }

    const errors = validateRow(partial)

    result.push({ ...partial, errors, isValid: errors.length === 0 })
  }

  return result
}
