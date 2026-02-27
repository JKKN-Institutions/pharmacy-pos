/**
 * Pure utilities for medicine bulk-import duplicate detection.
 * No Supabase imports — safe for use in both client and server contexts.
 */

import type { ParsedMedicineRow } from '@/lib/utils/parse-medicines-excel'

export const FUZZY_THRESHOLD = 3

/**
 * Early-exit Levenshtein distance using two-row DP.
 * Returns FUZZY_THRESHOLD + 1 immediately when the true distance is
 * provably larger than the threshold, saving CPU for large catalogues.
 */
export function levenshteinDistance(a: string, b: string): number {
  // Quick length-diff exit (single row of DP would never beat threshold)
  if (Math.abs(a.length - b.length) > FUZZY_THRESHOLD) return FUZZY_THRESHOLD + 1

  const m = a.length
  const n = b.length

  // Two-row rolling DP — O(n) space instead of O(m*n)
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  let curr = new Array<number>(n + 1).fill(0)

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    let rowMin = curr[0]
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1]
      } else {
        curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
      }
      rowMin = Math.min(rowMin, curr[j])
    }
    // If every cell in this row exceeds the threshold, the final distance will too
    if (rowMin > FUZZY_THRESHOLD) return FUZZY_THRESHOLD + 1
    ;[prev, curr] = [curr, prev]
  }

  return prev[n]
}

/**
 * Composite fingerprint for exact-duplicate detection.
 * Combines name + company + genericName + unit (all lowercased + trimmed)
 * so that the same medicine name from a different company is NOT flagged
 * as a duplicate.
 */
export function buildFingerprint(
  name: string,
  company?: string | null,
  genericName?: string | null,
  unit?: string | null,
): string {
  return [name, company ?? '', genericName ?? '', unit ?? '']
    .map((s) => s.toLowerCase().trim())
    .join('||')
}

export interface ExactConflict {
  raw_row: number
  importedRow: ParsedMedicineRow
  existingId: string
  existingName: string
  existingCompany: string | null
  existingGenericName: string | null
  existingUnit: string | null
}

export interface FuzzyMatch {
  raw_row: number
  importedName: string
  existingId: string
  existingName: string
  distance: number
}

export type ConflictAction = 'skip' | 'overwrite'

export interface ConflictResolutionEntry {
  action: ConflictAction
  existingId: string
}

/** Keyed by raw_row from ParsedMedicineRow */
export type ConflictResolutionsMap = Record<number, ConflictResolutionEntry>
