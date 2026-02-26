import * as XLSX from 'xlsx'

export interface ParsedMedicineRow {
  name: string
  company: string | null
  unit: string | null
  unit_packing: string | null
  category: string | null
  store_location: string | null
  reorder_level: number
  status: 'active' | 'inactive'
  live_stock: number | null   // display-only; NOT imported into medicines table
  raw_row: number             // original sheet row index (for error messages)
}

/**
 * The source system exports medicine names duplicated:
 *   "MEGACLAV-625 MEGACLAV-625" → "MEGACLAV-625"
 *   "ATOWICK-CV 10/75 CAPS ATOWICK-CV 10/75 CAPS" → "ATOWICK-CV 10/75 CAPS"
 *
 * Pattern: full text = A + ' ' + A, so A = text.slice(0, (len-1)/2)
 */
function fixDuplicatedName(text: string): string {
  const t = text.trim()
  if (t.length < 3) return t

  // Try both floor and ceil in case of rounding edge cases
  for (const mid of [Math.floor((t.length - 1) / 2), Math.ceil((t.length - 1) / 2)]) {
    const a = t.slice(0, mid).trim()
    const b = t.slice(mid + 1).trim() // +1 skips the space separator
    if (a.length > 0 && a === b) return a
  }

  return t
}

/**
 * Parses an uploaded .xlsx / .xls / .csv file into structured medicine rows.
 *
 * The Excel from the source system has:
 *   Row 0 — title row (skipped via header-detection)
 *   Row 1 — headers:  #, Medicine, Company, Unit, Unit/Packing, Category,
 *                     Storebox, Reorderlevel, Live Stock, Status, View Edit
 *   Rows 2+ — data
 */
export function parseMedicinesFile(
  buffer: ArrayBuffer,
  filename: string,
): ParsedMedicineRow[] {
  const lname = filename.toLowerCase()
  let rows: Array<Record<string, unknown>>

  if (lname.endsWith('.csv')) {
    // ── CSV path ──────────────────────────────────────────────────────────────
    const text = new TextDecoder().decode(buffer)
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map((h) => h.trim())
    rows = lines
      .slice(1)
      .map((line) => {
        const cols = line.split(',').map((v) => v.trim())
        return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? '']))
      })
      .filter((r) => Object.values(r).some((v) => v !== ''))
  } else {
    // ── Excel path (.xlsx / .xls) ─────────────────────────────────────────────
    const wb = XLSX.read(buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]

    // Read raw (array-of-arrays) to locate the actual header row.
    // The source Excel has a title row before the column headers.
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: null,
    })

    let headerRowIdx = 0
    for (let i = 0; i < Math.min(5, rawRows.length); i++) {
      const row = rawRows[i] as unknown[]
      if (
        row?.some(
          (cell) => String(cell ?? '').toLowerCase().trim() === 'medicine',
        )
      ) {
        headerRowIdx = i
        break
      }
    }

    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      range: headerRowIdx, // use this row as the header row
    })
  }

  // ── Normalize + map each row ────────────────────────────────────────────────
  const result: ParsedMedicineRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    // Lowercase + trim all keys for case-insensitive lookup
    const r: Record<string, string | null> = {}
    for (const [k, v] of Object.entries(row)) {
      const key = k.toLowerCase().trim()
      r[key] = v != null && String(v).trim() ? String(v).trim() : null
    }

    // Medicine name is required
    const rawName = r['medicine'] ?? ''
    if (!rawName) continue
    const name = fixDuplicatedName(rawName)
    if (!name || name.length < 2) continue

    // Reorder level (various spellings from different exports)
    const reorderRaw =
      r['reorderlevel'] ??
      r['reorder level'] ??
      r['reorder_level'] ??
      ''
    const reorder_level = parseInt(reorderRaw ?? '', 10)

    // Live stock — NOT imported into medicines table, displayed in preview only
    const liveRaw =
      r['live stock'] ?? r['livestock'] ?? r['live_stock'] ?? ''
    const liveNum = liveRaw ? parseFloat(liveRaw) : NaN
    const live_stock = !isNaN(liveNum) ? liveNum : null

    // Status: source system uses "Normal" | "Minlevel" — both mean the medicine
    // is active (Minlevel = stock is low, not medicine is inactive)
    const statusRaw = (r['status'] ?? '').toLowerCase().trim()
    const status: 'active' | 'inactive' =
      statusRaw === 'inactive' ? 'inactive' : 'active'

    result.push({
      name,
      company: r['company'] ?? null,
      unit: r['unit'] ?? null,
      unit_packing: r['unit/packing'] ?? r['unit_packing'] ?? null,
      category: r['category'] ?? null,
      store_location: r['storebox'] ?? r['store_location'] ?? null,
      reorder_level: isNaN(reorder_level) ? 20 : reorder_level,
      status,
      live_stock,
      raw_row: i + 1,
    })
  }

  return result
}
