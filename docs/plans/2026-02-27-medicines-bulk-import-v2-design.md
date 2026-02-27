# Medicines Bulk Import v2 — Design

**Date:** 2026-02-27
**Module:** `app/(dashboard)/medicines` + `components/medicines/`
**Status:** Approved, ready for implementation

---

## Problem

The current bulk import dialog (`bulk-import-dialog.tsx`, ~58 KB) has three gaps:

1. **Template is CSV** — should be `.xlsx` with enforced dropdown validation so users can't submit bad unit/tax/status values before even uploading.
2. **No preview step** — after upload, validation fires immediately with no chance to verify the parsed data looks correct.
3. **Validate step shows only error rows** — users cannot see all rows with their per-row validation status.

---

## New Step Flow

```
Upload → Preview (NEW) → Validate (IMPROVED) → [Checking] → [Fuzzy] → [Conflicts] → Import → Result
```

The `Preview` step is inserted between Upload and Validate. Fuzzy, Conflicts, Import, and Result steps are unchanged in logic — just extracted to separate files.

---

## Architecture Decision: Split Sub-components (Approach B)

The existing 58 KB single-file dialog is split into focused step components:

```
components/medicines/bulk-import/
  index.ts                      ← re-exports BulkImportDialog (no changes to consumers)
  bulk-import-dialog.tsx        ← orchestrator: step machine, all state, server action calls
  steps/
    upload-step.tsx             ← drag-drop zone + .xlsx template download
    preview-step.tsx            ← NEW: parsed rows table, file stats
    validate-step.tsx           ← IMPROVED: all rows + status badges + filter tabs
    fuzzy-step.tsx              ← fuzzy match review (logic unchanged)
    conflicts-step.tsx          ← conflict resolution (logic unchanged)
    import-preview-step.tsx     ← pre-import summary + live progress bar
    result-step.tsx             ← completion stats

lib/utils/
  generate-medicines-template.ts  ← NEW: .xlsx template with dropdowns + styles
```

`BulkImportButton` (`components/medicines/bulk-import-button.tsx`) import path is unchanged — it imports from `./bulk-import-dialog` which now comes from the new folder via `index.ts`.

---

## Excel Template (`generate-medicines-template.ts`)

- Uses `xlsx` library (already installed as `"xlsx": "^0.18.5"`)
- **Columns:** Medicine*, Company, Unit, Unit/Packing, Category, Storebox, Reorderlevel, Status, Generic Name, Tax%
- **Styled header row:** blue fill (`#1d4ed8`), white bold text
- **3 example rows** with realistic pharmacy data
- **Enforced dropdown validations:**
  - `Unit` column: Tablet | Capsule | Syrup | Injection | Ointment | Drops | Cream | Powder | Sachet | Gel | Solution | Suspension (error on invalid)
  - `Status` column: Normal | Inactive (error on invalid)
  - `Tax%` column: 0 | 5 | 12 | 18 | 28 (error on invalid)
- **Column widths:** Medicine=40, Company=20, Unit=14, Unit/Packing=16, Category=18, Storebox=14, Reorderlevel=14, Status=12, Generic Name=24, Tax%=8
- Download filename: `medicines_import_template.xlsx`

---

## Preview Step (`preview-step.tsx`)

Shown after file is successfully parsed, before validation runs.

**Contents:**
- **File stats bar:** "N rows parsed from `filename.xlsx`" with file size
- **Scrollable table (25 rows per page):**
  - Columns: Row# · Medicine · Company · Unit · Category · Tax% · Status
  - Striped rows, compact text-xs
  - Prev/Next pagination if > 25 rows
- **Buttons (footer):**
  - Back → returns to Upload step, clears parsed rows
  - "Run Validation →" → advances to Validate step

No validation logic runs in this step — it is purely a data review.

---

## Validate Step (Improved) (`validate-step.tsx`)

Replaces the current validate step which only shows error rows.

**Summary cards (top):**
| Card | Colour | Value |
|------|--------|-------|
| Total Rows | neutral | `allRows.length` |
| ✓ Valid | green | `validRows.length` |
| ✗ Errors | red | `errorRows.length` |
| ⚠ Duplicates | amber | `duplicateRows.length` |

**Filter tabs:** All · Valid (n) · Errors (n) · Duplicates (n)

**Table (all rows, filtered by active tab):**
- Columns: Row# · Medicine · Unit · Tax% · Validation Status (badge) · Issue
- Status badges: `✓ Valid` (green) · `✗ Error` (red) · `⚠ Duplicate` (amber)
- Issue column: shows error/duplicate reason inline; empty for valid rows
- Scrollable with sticky header

**Footer buttons:**
- Back → returns to Preview step
- "Check for Conflicts →" (disabled when `validRows.length === 0`) → triggers duplicate check

---

## Steps That Are Unchanged (Logic)

- **Checking** — transient overlay, shown while `checkBulkDuplicatesAction` runs
- **Fuzzy** — fuzzy match review with same/different decisions
- **Conflicts** — exact conflict resolution (skip/overwrite per row)
- **Import/Preview** — pre-import row count summary + live progress bar during insert batches
- **Result** — inserted/overwritten/skipped/errors summary

All server actions in `actions.ts` are unchanged.

---

## Migration Notes

- Old `components/medicines/bulk-import-dialog.tsx` is deleted.
- New entry point: `components/medicines/bulk-import/index.ts` exports `{ BulkImportDialog }`.
- `BulkImportButton` import `'./bulk-import-dialog'` → update to `'./bulk-import'`.
- `parse-medicines-excel.ts` accepts `.csv` internally but the upload UI now accepts only `.xlsx,.xls` (no CSV in the file input `accept` attribute). The parser still handles CSV if needed.
