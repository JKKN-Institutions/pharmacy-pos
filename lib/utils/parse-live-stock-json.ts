import * as XLSX from 'xlsx'
import type { ParsedStockBatchRow } from './parse-stock-batches-excel'

/**
 * Shape of each record in the Live_Stock_Pharmacy_Management.xlsx export.
 */
interface LiveStockRecord {
  '#': number
  Name: string
  Batch: string | number
  Expiry: string            // "MM-YYYY" format
  'Purchase Price': number | string
  'Sale Price': number | string
  Qty: number
  Sold: number
  'current stock': number
}

/**
 * Converts MM-YYYY expiry string to YYYY-MM-DD (last day of month).
 * e.g. "01-2027" → "2027-01-31"
 */
function parseMMYYYY(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})-(\d{4})$/)
  if (!match) return null
  const [, m, y] = match
  const month = parseInt(m, 10)
  if (month < 1 || month > 12) return null
  const lastDay = new Date(parseInt(y, 10), month, 0).getDate()
  return `${y}-${m.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

/**
 * Strips ₹, Rs., commas and whitespace then parses as float.
 */
function cleanPrice(raw: unknown): number {
  if (typeof raw === 'number') return raw
  if (!raw) return 0
  const cleaned = String(raw).replace(/[₹$€£\s,]/g, '').replace(/^Rs\.?/i, '')
  return parseFloat(cleaned) || 0
}

export interface ParseLiveStockResult {
  rows: ParsedStockBatchRow[]
  skippedRows: Array<{ row: number; name: string; reason: string }>
  stats: {
    total: number
    valid: number
    skipped: number
    uniqueMedicines: number
    zeroStock: number
    soldCorrected: number
  }
}

/**
 * Parses the Live Stock Excel/JSON export into ParsedStockBatchRow[].
 *
 * Accepts either:
 *  - An ArrayBuffer from an .xlsx/.xls/.csv file upload
 *  - A parsed JSON array (for .json files)
 *
 * Key transforms:
 * - Batch field (number | string) → string
 * - Expiry "MM-YYYY" → "YYYY-MM-DD" (last day of month)
 * - Back-calculates sold_qty = Qty - current_stock (trusts "current stock")
 * - Price fields cleaned of ₹ symbols (handles both .xlsx numbers and CSV strings)
 * - Includes ALL rows including zero-stock batches
 */
export function parseLiveStockFile(
  input: ArrayBuffer | unknown[],
  filename?: string,
): ParseLiveStockResult {
  let records: LiveStockRecord[]

  if (input instanceof ArrayBuffer) {
    // Parse Excel / CSV file
    const lname = (filename ?? '').toLowerCase()
    let rawRows: Array<Record<string, unknown>>

    if (lname.endsWith('.csv')) {
      const text = new TextDecoder().decode(input)
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      if (lines.length < 3) {
        return emptyResult()
      }
      // Find header row (row with "Name" column)
      let headerIdx = 0
      for (let i = 0; i < Math.min(5, lines.length); i++) {
        if (lines[i].toLowerCase().includes('name') && lines[i].toLowerCase().includes('batch')) {
          headerIdx = i
          break
        }
      }
      const headers = lines[headerIdx].split(',').map((h) => h.trim())
      rawRows = lines
        .slice(headerIdx + 1)
        .map((line) => {
          const cols = line.split(',').map((v) => v.trim())
          return Object.fromEntries(headers.map((h, j) => [h, cols[j] ?? '']))
        })
        .filter((r) => Object.values(r).some((v) => v !== ''))
    } else {
      // .xlsx / .xls
      const wb = XLSX.read(input, { type: 'array', cellDates: false })
      const ws = wb.Sheets[wb.SheetNames[0]]

      // Find header row — look for "Name" + "Batch" in first 5 rows
      const probe = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })
      let headerRowIdx = 0
      for (let i = 0; i < Math.min(5, probe.length); i++) {
        const row = probe[i] as unknown[]
        if (
          row?.some((c) => {
            const s = String(c ?? '').toLowerCase().trim()
            return s === 'name'
          }) &&
          row?.some((c) => {
            const s = String(c ?? '').toLowerCase().trim()
            return s === 'batch'
          })
        ) {
          headerRowIdx = i
          break
        }
      }

      rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: null,
        range: headerRowIdx,
      })
    }

    records = rawRows as unknown as LiveStockRecord[]
  } else if (Array.isArray(input)) {
    // JSON array passed directly
    records = input as LiveStockRecord[]
  } else {
    return emptyResult()
  }

  return processRecords(records)
}

/** Backward-compatible alias for JSON data */
export function parseLiveStockJSON(data: unknown): ParseLiveStockResult {
  if (!Array.isArray(data)) return emptyResult()
  return processRecords(data as LiveStockRecord[])
}

function emptyResult(): ParseLiveStockResult {
  return {
    rows: [],
    skippedRows: [],
    stats: { total: 0, valid: 0, skipped: 0, uniqueMedicines: 0, zeroStock: 0, soldCorrected: 0 },
  }
}

function processRecords(records: LiveStockRecord[]): ParseLiveStockResult {
  const rows: ParsedStockBatchRow[] = []
  const skippedRows: Array<{ row: number; name: string; reason: string }> = []
  const medicineNames = new Set<string>()
  let zeroStock = 0
  let soldCorrected = 0

  for (let i = 0; i < records.length; i++) {
    const rec = records[i]
    const rowNum = Number(rec['#']) || i + 1
    const name = (rec.Name ?? '').toString().trim()

    // Skip empty / __EMPTY rows
    if (!name || name.length < 2) {
      skippedRows.push({ row: rowNum, name: name || '(empty)', reason: 'Medicine name missing or too short' })
      continue
    }

    // Validate batch
    const batchNo = String(rec.Batch ?? '').trim()
    if (!batchNo) {
      skippedRows.push({ row: rowNum, name, reason: 'Batch number missing' })
      continue
    }

    // Parse expiry (MM-YYYY → YYYY-MM-DD last day of month)
    const expiryDate = parseMMYYYY(String(rec.Expiry ?? ''))
    if (!expiryDate) {
      skippedRows.push({ row: rowNum, name, reason: `Invalid expiry format: "${rec.Expiry}"` })
      continue
    }

    // Validate qty
    const qty = Number(rec.Qty) || 0
    if (qty <= 0) {
      skippedRows.push({ row: rowNum, name, reason: 'Quantity must be > 0' })
      continue
    }

    const purchasePrice = cleanPrice(rec['Purchase Price'])
    const salePrice = cleanPrice(rec['Sale Price'])
    const currentStock = Math.max(0, Number(rec['current stock']) || 0)

    // Back-calculate sold: trust "current stock" as ground truth
    const correctedSold = Math.max(0, qty - currentStock)
    if (correctedSold !== (Number(rec.Sold) || 0)) {
      soldCorrected++
    }

    if (currentStock === 0) zeroStock++
    medicineNames.add(name.toLowerCase())

    rows.push({
      medicine_name: name,
      batch_number: batchNo,
      expiry_date: expiryDate,
      purchase_price: purchasePrice,
      selling_price: salePrice,
      qty,
      sold: correctedSold,
      available: currentStock,
      raw_row: rowNum,
    })
  }

  return {
    rows,
    skippedRows,
    stats: {
      total: records.length,
      valid: rows.length,
      skipped: skippedRows.length,
      uniqueMedicines: medicineNames.size,
      zeroStock,
      soldCorrected,
    },
  }
}
