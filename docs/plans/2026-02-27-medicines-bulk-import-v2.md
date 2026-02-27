# Medicines Bulk Import v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single 58KB bulk-import dialog with a split sub-component wizard that adds an Excel template (`.xlsx`), a file preview step, and an all-rows validation table with per-row status badges.

**Architecture:** The new orchestrator at `components/medicines/bulk-import/bulk-import-dialog.tsx` owns all state and server-action calls. Each wizard step is a focused React component in `steps/`. A new utility `lib/utils/generate-medicines-template.ts` generates the `.xlsx` template using the `xlsx` library already installed.

**Tech Stack:** Next.js 16 App Router, `'use client'` components, `xlsx` (SheetJS CE 0.18.5), shadcn/ui (Dialog, Table, Badge, Button, Tabs), lucide-react icons, existing server actions in `app/(dashboard)/medicines/actions.ts` (unchanged).

---

## New file tree

```
components/medicines/bulk-import/
  index.ts
  bulk-import-dialog.tsx          ← orchestrator
  steps/
    upload-step.tsx
    preview-step.tsx              ← NEW
    validate-step.tsx             ← IMPROVED (all rows + status badges + filter tabs)
    fuzzy-step.tsx
    conflicts-step.tsx
    import-preview-step.tsx
    result-step.tsx

lib/utils/
  generate-medicines-template.ts  ← NEW
```

The old `components/medicines/bulk-import-dialog.tsx` is deleted at the end.

---

## Shared types (defined in orchestrator, imported by steps)

```typescript
// in bulk-import-dialog.tsx — exported so steps can import them
export type Step =
  | 'upload' | 'preview' | 'validate' | 'checking'
  | 'fuzzy' | 'conflicts' | 'import' | 'result'

export type ImportPhase = 'idle' | 'preparing' | 'inserting'

export interface ImportProgress {
  phase: ImportPhase
  currentBatch: number
  totalBatches: number
  insertedSoFar: number
}

export interface RowValidation {
  row: ParsedMedicineRow
  status: 'valid' | 'duplicate' | 'error'
  reason?: string
}

export interface ImportResult {
  inserted: number
  overwritten: number
  skipped: number
  errors: string[]
}
```

---

## Task 1: Create the Excel template generator

**Files:**
- Create: `lib/utils/generate-medicines-template.ts`

**Step 1: Create the file**

```typescript
// lib/utils/generate-medicines-template.ts
import * as XLSX from 'xlsx'
import { VALID_UNITS, VALID_GST_SLABS } from '@/lib/validators/medicine-schema'

export function generateMedicinesTemplate(): void {
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Import template ──────────────────────────────────────────────
  const headers = [
    'Medicine', 'Company', 'Unit', 'Unit/Packing', 'Category',
    'Storebox', 'Reorderlevel', 'Status', 'Generic Name', 'Tax%',
  ]

  const examples = [
    ['PARACETAMOL 500MG TAB', 'Cipla Ltd',   'Tablet',  'Strip of 10',  'Analgesic',   'Rack A-1', '20', 'Normal',   'Paracetamol',       '5'],
    ['AMOXICILLIN 250MG CAP', 'Sun Pharma',  'Capsule', 'Strip of 10',  'Antibiotic',  'Rack B-2', '15', 'Normal',   'Amoxicillin',       '12'],
    ['COUGH SYRUP 100ML',     'Mankind',     'Syrup',   'Bottle 100ml', 'Respiratory', 'Rack C-1', '10', 'Normal',   'Dextromethorphan',  '12'],
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples])

  // Column widths
  ws['!cols'] = [
    { wch: 40 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 18 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 24 }, { wch: 8 },
  ]

  // Header row fill + font (SheetJS CE supports basic cell styles)
  headers.forEach((_, colIdx) => {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: colIdx })
    if (!ws[cellAddr]) return
    ws[cellAddr].s = {
      fill:  { patternType: 'solid', fgColor: { rgb: '1D4ED8' } },
      font:  { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      alignment: { horizontal: 'center' },
    }
  })

  // Data validations for Unit (col C = index 2), Status (col H = index 7), Tax% (col J = index 9)
  // SheetJS CE 0.18.x supports !dataValidations on worksheet
  const unitList   = VALID_UNITS.join(',')
  const taxList    = VALID_GST_SLABS.join(',')

  ;(ws as XLSX.WorkSheet & { '!dataValidations'?: object[] })['!dataValidations'] = [
    {
      sqref: 'C2:C10000',
      type: 'list',
      formula1: `"${unitList}"`,
      showErrorMessage: true,
      error: `Unit must be one of: ${unitList}`,
      errorTitle: 'Invalid Unit',
    },
    {
      sqref: 'H2:H10000',
      type: 'list',
      formula1: '"Normal,Inactive"',
      showErrorMessage: true,
      error: 'Status must be Normal or Inactive',
      errorTitle: 'Invalid Status',
    },
    {
      sqref: 'J2:J10000',
      type: 'list',
      formula1: `"${taxList}"`,
      showErrorMessage: true,
      error: `Tax% must be a GST slab: ${taxList}`,
      errorTitle: 'Invalid Tax%',
    },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Medicines Import')

  // ── Sheet 2: Reference (valid values guide) ───────────────────────────────
  const refWs = XLSX.utils.aoa_to_sheet([
    ['Column',      'Valid Values',                        'Notes'],
    ['Medicine',    '(any text)',                          'Required. Minimum 2 characters.'],
    ['Company',     '(any text)',                          'Optional'],
    ['Unit',        VALID_UNITS.join(', '),                'Must match exactly (case-sensitive)'],
    ['Unit/Packing','(any text)',                          'e.g. Strip of 10, Bottle 100ml'],
    ['Category',    '(any text)',                          'Created automatically if not found'],
    ['Storebox',    '(any text)',                          'e.g. Rack A-1, Shelf B'],
    ['Reorderlevel','(number)',                            'Defaults to 20 if blank'],
    ['Status',      'Normal, Inactive',                   'Normal = active medicine'],
    ['Generic Name','(any text)',                          'Optional, used for duplicate detection'],
    ['Tax%',        VALID_GST_SLABS.join(', '),           'Indian GST slabs only'],
  ])
  refWs['!cols'] = [{ wch: 16 }, { wch: 60 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, refWs, 'Reference')

  // Trigger browser download
  XLSX.writeFile(wb, 'medicines_import_template.xlsx')
}
```

**Step 2: Verify the file compiles**

Run: `npm run build 2>&1 | grep -i "generate-medicines"` — should be no errors.

**Step 3: Commit**

```bash
git add lib/utils/generate-medicines-template.ts
git commit -m "feat: add Excel template generator for medicines bulk import"
```

---

## Task 2: Create folder structure and index

**Files:**
- Create: `components/medicines/bulk-import/index.ts`
- Create directory stubs for all step files

**Step 1: Create index.ts**

```typescript
// components/medicines/bulk-import/index.ts
export { BulkImportDialog } from './bulk-import-dialog'
```

**Step 2: Create empty placeholder files (so TypeScript resolves imports)**

Create these files with just a `// TODO` comment — they will be filled in subsequent tasks:
- `components/medicines/bulk-import/steps/upload-step.tsx`
- `components/medicines/bulk-import/steps/preview-step.tsx`
- `components/medicines/bulk-import/steps/validate-step.tsx`
- `components/medicines/bulk-import/steps/fuzzy-step.tsx`
- `components/medicines/bulk-import/steps/conflicts-step.tsx`
- `components/medicines/bulk-import/steps/import-preview-step.tsx`
- `components/medicines/bulk-import/steps/result-step.tsx`

---

## Task 3: Create `upload-step.tsx`

**Files:**
- Create: `components/medicines/bulk-import/steps/upload-step.tsx`

This is largely the same as the upload panel in the old dialog, but the template button now calls `generateMedicinesTemplate()` (xlsx) and accepts only `.xlsx,.xls`.

**Step 1: Write the component**

```typescript
// components/medicines/bulk-import/steps/upload-step.tsx
'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, FileSpreadsheet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { VALID_UNITS, VALID_GST_SLABS } from '@/lib/validators/medicine-schema'
import { generateMedicinesTemplate } from '@/lib/utils/generate-medicines-template'
import type { ParsedMedicineRow } from '@/lib/utils/parse-medicines-excel'
import { parseMedicinesFile } from '@/lib/utils/parse-medicines-excel'
import { toast } from 'sonner'

interface UploadStepProps {
  onFileLoaded: (rows: ParsedMedicineRow[], filename: string) => void
}

export function UploadStep({ onFileLoaded }: UploadStepProps) {
  const fileRef  = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [parsing,  setParsing ] = useState(false)

  async function processFile(file: File) {
    setParsing(true)
    try {
      const buffer = await file.arrayBuffer()
      const parsed = parseMedicinesFile(buffer, file.name)
      if (!parsed.length) {
        toast.error('No valid medicine rows found in the file')
        return
      }
      onFileLoaded(parsed, file.name)
    } catch (e) {
      toast.error('Failed to parse file: ' + (e as Error).message)
    } finally {
      setParsing(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  return (
    <div className="px-6 py-5 space-y-5 overflow-y-auto">
      <p className="text-sm text-muted-foreground">
        Upload an Excel (.xlsx / .xls) file. The system will let you preview the data,
        validate each row, check for conflicts, then import with a progress bar.
      </p>

      {/* Drop zone */}
      <div
        className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer select-none
          ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/30'}
          ${parsing   ? 'opacity-60 pointer-events-none' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium mb-1">
          {parsing ? 'Parsing file…' : 'Drop your Excel file here or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground">Supports .xlsx, .xls</p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Expected columns */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Expected columns
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: 'Medicine',     required: true  },
            { label: 'Company',      required: false },
            { label: 'Unit',         required: false },
            { label: 'Unit/Packing', required: false },
            { label: 'Category',     required: false },
            { label: 'Storebox',     required: false },
            { label: 'Reorderlevel', required: false },
            { label: 'Status',       required: false },
            { label: 'Generic Name', required: false },
            { label: 'Tax%',         required: false },
          ].map(({ label, required }) => (
            <span
              key={label}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono border
                ${required
                  ? 'bg-primary/5 border-primary/30 text-primary'
                  : 'bg-muted border-border text-muted-foreground'
                }`}
            >
              {label}
              {required && <span className="text-primary font-bold">*</span>}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          * required &nbsp;·&nbsp; Unit: {VALID_UNITS.join(', ')} &nbsp;·&nbsp;
          Tax%: {VALID_GST_SLABS.join(', ')}
        </p>
      </div>

      {/* Template download */}
      <Button variant="outline" size="sm" className="w-full" onClick={generateMedicinesTemplate}>
        <Download className="w-4 h-4 mr-2" />
        Download Excel Template (.xlsx)
      </Button>
    </div>
  )
}
```

---

## Task 4: Create `preview-step.tsx` (NEW)

**Files:**
- Create: `components/medicines/bulk-import/steps/preview-step.tsx`

Shows parsed rows in a paginated table before any validation runs.

**Step 1: Write the component**

```typescript
// components/medicines/bulk-import/steps/preview-step.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ParsedMedicineRow } from '@/lib/utils/parse-medicines-excel'

const PAGE_SIZE = 25

interface PreviewStepProps {
  rows:     ParsedMedicineRow[]
  filename: string
  onBack:   () => void
  onNext:   () => void
}

export function PreviewStep({ rows, filename, onBack, onNext }: PreviewStepProps) {
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const pageRows   = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col min-h-0 flex-1">

      {/* Stats bar */}
      <div className="px-6 py-3 flex items-center gap-3 flex-shrink-0 border-b bg-muted/30">
        <FileSpreadsheet className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm">
          <span className="font-semibold">{rows.length.toLocaleString()} rows</span>
          <span className="text-muted-foreground"> parsed from </span>
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{filename}</span>
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          Review the data below, then click &quot;Run Validation&quot;
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="bg-muted/80 hover:bg-muted/80 backdrop-blur">
              <TableHead className="text-xs pl-6 w-12">Row</TableHead>
              <TableHead className="text-xs min-w-[180px]">Medicine</TableHead>
              <TableHead className="text-xs">Company</TableHead>
              <TableHead className="text-xs">Unit</TableHead>
              <TableHead className="text-xs">Category</TableHead>
              <TableHead className="text-xs">Tax%</TableHead>
              <TableHead className="text-xs pr-6">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row) => (
              <TableRow key={row.raw_row} className="border-b border-border/40">
                <TableCell className="text-xs text-muted-foreground pl-6 tabular-nums">
                  {row.raw_row}
                </TableCell>
                <TableCell className="text-xs font-medium max-w-[220px]">
                  <div className="truncate">{row.name}</div>
                  {row.generic_name && (
                    <div className="text-muted-foreground truncate mt-0.5">{row.generic_name}</div>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[140px]">
                  <div className="truncate">{row.company ?? '—'}</div>
                </TableCell>
                <TableCell className="text-xs">{row.unit ?? '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[120px]">
                  <div className="truncate">{row.category ?? '—'}</div>
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {row.tax_percent != null ? `${row.tax_percent}%` : '—'}
                </TableCell>
                <TableCell className="text-xs pr-6 capitalize">{row.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 flex items-center justify-between flex-shrink-0 border-t">
        <Button variant="outline" onClick={onBack}>Back</Button>

        <div className="flex items-center gap-3">
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span>Page {page} / {totalPages}</span>
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <Button onClick={onNext}>
            Run Validation →
          </Button>
        </div>
      </div>
    </div>
  )
}
```

---

## Task 5: Create `validate-step.tsx` (IMPROVED)

**Files:**
- Create: `components/medicines/bulk-import/steps/validate-step.tsx`

Shows ALL rows with per-row status badges and filter tabs. Replaces the old validate step that only showed error rows.

**Step 1: Write the component**

```typescript
// components/medicines/bulk-import/steps/validate-step.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { CheckCircle2, ScanSearch } from 'lucide-react'
import type { RowValidation } from '../bulk-import-dialog'

type FilterTab = 'all' | 'valid' | 'errors' | 'duplicates'

interface ValidateStepProps {
  allRows:              RowValidation[]
  filename:             string
  onBack:               () => void
  onCheckDuplicates:    () => void
}

export function ValidateStep({
  allRows, filename, onBack, onCheckDuplicates,
}: ValidateStepProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const validRows     = allRows.filter((r) => r.status === 'valid')
  const errorRows     = allRows.filter((r) => r.status === 'error')
  const duplicateRows = allRows.filter((r) => r.status === 'duplicate')

  const displayRows = activeTab === 'all'        ? allRows
                    : activeTab === 'valid'       ? validRows
                    : activeTab === 'errors'      ? errorRows
                    : duplicateRows

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all',        label: 'All',        count: allRows.length      },
    { key: 'valid',      label: 'Valid',       count: validRows.length    },
    { key: 'errors',     label: 'Errors',      count: errorRows.length    },
    { key: 'duplicates', label: 'Duplicates',  count: duplicateRows.length },
  ]

  function statusBadge(rv: RowValidation) {
    if (rv.status === 'valid') return (
      <Badge variant="outline" className="text-xs border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 gap-1">
        <CheckCircle2 className="h-3 w-3" /> Valid
      </Badge>
    )
    if (rv.status === 'error') return (
      <Badge variant="outline" className="text-xs border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-400">
        ✗ Error
      </Badge>
    )
    return (
      <Badge variant="outline" className="text-xs border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
        ⚠ Duplicate
      </Badge>
    )
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">

      {/* Summary cards */}
      <div className="px-6 py-4 flex-shrink-0">
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold tabular-nums">{allRows.length.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Rows</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 p-3 text-center">
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {validRows.length.toLocaleString()}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">✓ Valid</p>
          </div>
          <div className={`rounded-lg border p-3 text-center ${errorRows.length > 0 ? 'border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-800' : 'border-border'}`}>
            <p className={`text-2xl font-bold tabular-nums ${errorRows.length > 0 ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'}`}>
              {errorRows.length.toLocaleString()}
            </p>
            <p className={`text-xs mt-0.5 ${errorRows.length > 0 ? 'text-red-600 dark:text-red-500' : 'text-muted-foreground'}`}>✗ Errors</p>
          </div>
          <div className={`rounded-lg border p-3 text-center ${duplicateRows.length > 0 ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800' : 'border-border'}`}>
            <p className={`text-2xl font-bold tabular-nums ${duplicateRows.length > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
              {duplicateRows.length.toLocaleString()}
            </p>
            <p className={`text-xs mt-0.5 ${duplicateRows.length > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'}`}>⚠ Duplicates</p>
          </div>
        </div>

        {/* All-clear alert */}
        {errorRows.length === 0 && duplicateRows.length === 0 && (
          <Alert className="py-2 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-xs text-emerald-700 dark:text-emerald-300">
              All {allRows.length.toLocaleString()} rows passed validation. Continue to check for DB conflicts.
            </AlertDescription>
          </Alert>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 mt-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                ${activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full
                  ${activeTab === tab.key ? 'bg-white/20' : 'bg-background'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Rows table */}
      <div className="flex-1 overflow-auto border-t border-b">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="bg-muted/80 hover:bg-muted/80 backdrop-blur">
              <TableHead className="text-xs pl-6 w-12">Row</TableHead>
              <TableHead className="text-xs min-w-[200px]">Medicine</TableHead>
              <TableHead className="text-xs">Unit</TableHead>
              <TableHead className="text-xs">Tax%</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs pr-6">Issue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((rv) => (
              <TableRow
                key={rv.row.raw_row}
                className={`border-b border-border/40
                  ${rv.status === 'error'     ? 'bg-red-50/30 dark:bg-red-950/10'  : ''}
                  ${rv.status === 'duplicate' ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''}`}
              >
                <TableCell className="text-xs text-muted-foreground pl-6 tabular-nums">
                  {rv.row.raw_row}
                </TableCell>
                <TableCell className="text-xs font-medium max-w-[240px]">
                  <div className="truncate">{rv.row.name}</div>
                  {rv.row.generic_name && (
                    <div className="text-muted-foreground truncate mt-0.5 text-[11px]">
                      {rv.row.generic_name}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-xs">{rv.row.unit ?? '—'}</TableCell>
                <TableCell className="text-xs tabular-nums">
                  {rv.row.tax_percent != null ? `${rv.row.tax_percent}%` : '—'}
                </TableCell>
                <TableCell>{statusBadge(rv)}</TableCell>
                <TableCell className="text-xs text-muted-foreground pr-6 max-w-[280px]">
                  <div className="truncate">{rv.reason ?? ''}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 flex items-center justify-between flex-shrink-0">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button disabled={validRows.length === 0} onClick={onCheckDuplicates}>
          <ScanSearch className="w-4 h-4 mr-2" />
          Check for Conflicts →
        </Button>
      </div>
    </div>
  )
}
```

---

## Task 6: Extract `fuzzy-step.tsx`

**Files:**
- Create: `components/medicines/bulk-import/steps/fuzzy-step.tsx`

Extract the fuzzy review step from the old `bulk-import-dialog.tsx` lines ~647–790 (the `step === 'fuzzy'` block). Wrap it in a component with these props:

```typescript
interface FuzzyStepProps {
  fuzzyMatches:   FuzzyMatch[]
  fuzzyDecisions: Record<number, 'different' | 'same'>
  onChange:       (rawRow: number, decision: 'different' | 'same') => void
  onBack:         () => void
  onNext:         () => void
}
```

Read the existing fuzzy JSX from the old dialog (search for `step === 'fuzzy'`) and move it verbatim into this component, replacing state reads with props.

---

## Task 7: Extract `conflicts-step.tsx`

**Files:**
- Create: `components/medicines/bulk-import/steps/conflicts-step.tsx`

Extract the conflicts step from old dialog. Props:

```typescript
interface ConflictsStepProps {
  exactConflicts:      ExactConflict[]
  conflictResolutions: ConflictResolutionsMap
  onChange:            (rawRow: number, action: ConflictAction, existingId: string) => void
  onBack:              () => void
  onNext:              () => void
}
```

---

## Task 8: Extract `import-preview-step.tsx`

**Files:**
- Create: `components/medicines/bulk-import/steps/import-preview-step.tsx`

Extract the preview + progress bar step. Props:

```typescript
interface ImportPreviewStepProps {
  validRows:           ParsedMedicineRow[]
  exactConflicts:      ExactConflict[]
  conflictResolutions: ConflictResolutionsMap
  skippedCount:        number
  isImporting:         boolean
  importProgress:      ImportProgress
  onBack:              () => void
  onImport:            () => void
}
```

The ProgressBar sub-component can be defined locally in this file:

```typescript
function ProgressBar({ value, indeterminate = false }: { value: number; indeterminate?: boolean }) {
  return (
    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
      <div
        className={`h-full rounded-full bg-primary transition-all duration-500
          ${indeterminate ? 'animate-pulse w-1/5' : ''}`}
        style={!indeterminate ? { width: `${Math.max(3, value)}%` } : undefined}
      />
    </div>
  )
}
```

---

## Task 9: Extract `result-step.tsx`

**Files:**
- Create: `components/medicines/bulk-import/steps/result-step.tsx`

Extract the result step. Props:

```typescript
interface ResultStepProps {
  result:   ImportResult
  onClose:  () => void
}
```

---

## Task 10: Create the new orchestrator `bulk-import-dialog.tsx`

**Files:**
- Create: `components/medicines/bulk-import/bulk-import-dialog.tsx`

This is the main state machine. It owns all state and calls all server actions. Steps are rendered by their components.

```typescript
// components/medicines/bulk-import/bulk-import-dialog.tsx
'use client'

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

import { parseMedicinesFile, type ParsedMedicineRow } from '@/lib/utils/parse-medicines-excel'
import {
  buildFingerprint,
  type ExactConflict,
  type FuzzyMatch,
  type ConflictAction,
  type ConflictResolutionsMap,
} from '@/lib/utils/duplicate-detection'
import {
  VALID_UNITS,
  VALID_GST_SLABS,
  type ValidUnit,
  type GstSlab,
} from '@/lib/validators/medicine-schema'
import {
  checkBulkDuplicatesAction,
  prepareBulkImportAction,
  insertMedicineBatchAction,
  upsertMedicineBatchAction,
  finalizeMedicinesImportAction,
} from '@/app/(dashboard)/medicines/actions'

import { UploadStep }        from './steps/upload-step'
import { PreviewStep }       from './steps/preview-step'
import { ValidateStep }      from './steps/validate-step'
import { FuzzyStep }         from './steps/fuzzy-step'
import { ConflictsStep }     from './steps/conflicts-step'
import { ImportPreviewStep } from './steps/import-preview-step'
import { ResultStep }        from './steps/result-step'

// ─── Exported types (used by step components) ─────────────────────────────────

export type Step =
  | 'upload' | 'preview' | 'validate' | 'checking'
  | 'fuzzy' | 'conflicts' | 'import' | 'result'

export type ImportPhase = 'idle' | 'preparing' | 'inserting'

export interface ImportProgress {
  phase: ImportPhase
  currentBatch: number
  totalBatches: number
  insertedSoFar: number
}

export interface RowValidation {
  row: ParsedMedicineRow
  status: 'valid' | 'duplicate' | 'error'
  reason?: string
}

export interface ImportResult {
  inserted: number
  overwritten: number
  skipped: number
  errors: string[]
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, steps }: {
  current: Step
  steps: { key: Step; label: string }[]
}) {
  const displayStep = current === 'checking' ? 'validate' : current
  const currentIdx  = steps.findIndex((s) => s.key === displayStep)

  return (
    <div className="flex items-start flex-wrap gap-y-2">
      {steps.map((step, idx) => {
        const isCompleted = idx < currentIdx
        const isActive    = idx === currentIdx
        return (
          <div key={step.key} className="flex items-start">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors
                ${isCompleted ? 'bg-primary border-primary text-primary-foreground'
                  : isActive   ? 'border-primary text-primary bg-primary/10'
                  : 'border-border text-muted-foreground bg-background'}`}
              >
                {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap
                ${isActive ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`h-0.5 w-10 mt-3.5 mx-1.5 shrink-0 transition-colors
                ${idx < currentIdx ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

const BATCH_SIZE = 200

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BulkImportDialog({ open, onOpenChange }: BulkImportDialogProps) {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [step,       setStep      ] = useState<Step>('upload')
  const [parsedRows, setParsedRows] = useState<ParsedMedicineRow[]>([])  // after parse, before validation
  const [allRows,    setAllRows   ] = useState<RowValidation[]>([])      // after validation
  const [filename,   setFilename  ] = useState('')

  const [importProgress, setImportProgress] = useState<ImportProgress>({
    phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0,
  })
  const [result, setResult] = useState<ImportResult | null>(null)

  // ── Duplicate-detection state ───────────────────────────────────────────────
  const [isChecking,          setIsChecking         ] = useState(false)
  const [fuzzyMatches,        setFuzzyMatches       ] = useState<FuzzyMatch[]>([])
  const [fuzzyDecisions,      setFuzzyDecisions     ] = useState<Record<number, 'different' | 'same'>>({})
  const [exactConflicts,      setExactConflicts     ] = useState<ExactConflict[]>([])
  const [conflictResolutions, setConflictResolutions] = useState<ConflictResolutionsMap>({})

  // ── Derived slices ──────────────────────────────────────────────────────────
  const validRows    = allRows.filter((r) => r.status === 'valid').map((r) => r.row)
  const skippedCount = allRows.filter((r) => r.status !== 'valid').length
  const isImporting  = importProgress.phase !== 'idle'

  // ── Dynamic step list ───────────────────────────────────────────────────────
  const visibleSteps = useMemo((): { key: Step; label: string }[] => {
    const s: { key: Step; label: string }[] = [
      { key: 'upload',  label: 'Upload'  },
      { key: 'preview', label: 'Preview' },
      { key: 'validate',label: 'Validate'},
    ]
    if (isChecking || fuzzyMatches.length > 0)
      s.push({ key: 'fuzzy', label: 'Fuzzy Review' })
    if (isChecking || fuzzyMatches.length > 0 || exactConflicts.length > 0)
      s.push({ key: 'conflicts', label: 'Conflicts' })
    s.push({ key: 'import', label: 'Import' }, { key: 'result', label: 'Done' })
    return s
  }, [isChecking, fuzzyMatches.length, exactConflicts.length])

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function resetDuplicateState() {
    setIsChecking(false); setFuzzyMatches([]); setFuzzyDecisions({})
    setExactConflicts([]); setConflictResolutions({})
  }

  function handleClose() {
    if (isImporting) return
    onOpenChange(false)
    setTimeout(() => {
      setStep('upload'); setParsedRows([]); setAllRows([]); setFilename('')
      setResult(null)
      setImportProgress({ phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })
      resetDuplicateState()
    }, 300)
  }

  // ── Upload → Preview ────────────────────────────────────────────────────────

  function handleFileLoaded(rows: ParsedMedicineRow[], name: string) {
    resetDuplicateState()
    setAllRows([])
    setParsedRows(rows)
    setFilename(name)
    setStep('preview')
  }

  // ── Preview → Validate (run client-side validation) ─────────────────────────

  function handleRunValidation() {
    const seenFPs = new Set<string>()
    const validated: RowValidation[] = parsedRows.map((row) => {
      if (!row.name || row.name.length < 2)
        return { row, status: 'error', reason: 'Name too short or missing' }

      if (row.unit && !VALID_UNITS.includes(row.unit as ValidUnit))
        return { row, status: 'error', reason: `Unit "${row.unit}" is not valid. Use: ${VALID_UNITS.join(', ')}` }

      if (row.tax_percent !== null && !VALID_GST_SLABS.includes(row.tax_percent as GstSlab))
        return { row, status: 'error', reason: `Tax ${row.tax_percent}% is not a valid GST slab (0, 5, 12, 18, 28)` }

      const fp = buildFingerprint(row.name, row.company, row.generic_name, row.unit)
      if (seenFPs.has(fp))
        return { row, status: 'duplicate', reason: 'Duplicate within this file (name + company + generic + unit)' }
      seenFPs.add(fp)
      return { row, status: 'valid' }
    })
    setAllRows(validated)
    setStep('validate')
  }

  // ── Validate → Duplicate check ───────────────────────────────────────────────

  async function handleCheckDuplicates() {
    setIsChecking(true)
    setStep('checking')

    const res = await checkBulkDuplicatesAction(validRows)
    setIsChecking(false)

    if (res.error) {
      toast.error(res.error); setStep('validate'); return
    }

    setFuzzyMatches(res.fuzzyMatches)
    setExactConflicts(res.exactConflicts)

    const defaultRes: ConflictResolutionsMap = {}
    res.exactConflicts.forEach((c) => {
      defaultRes[c.raw_row] = { action: 'skip', existingId: c.existingId }
    })
    setConflictResolutions(defaultRes)

    if      (res.fuzzyMatches.length > 0)  setStep('fuzzy')
    else if (res.exactConflicts.length > 0) setStep('conflicts')
    else setStep('import')
  }

  // ── Fuzzy next ───────────────────────────────────────────────────────────────

  function handleFuzzyNext() {
    const fuzzyConflicts: ExactConflict[] = fuzzyMatches
      .filter((fm) => fuzzyDecisions[fm.raw_row] === 'same')
      .map((fm) => {
        const importedRow = validRows.find((r) => r.raw_row === fm.raw_row)!
        return {
          raw_row: fm.raw_row, importedRow,
          existingId: fm.existingId, existingName: fm.existingName,
          existingCompany: null, existingGenericName: null, existingUnit: null,
        } as ExactConflict
      })

    const fuzzyRawRows    = new Set(fuzzyMatches.map((fm) => fm.raw_row))
    const serverConflicts = exactConflicts.filter((c) => !fuzzyRawRows.has(c.raw_row))
    const newExactConflicts = [...serverConflicts, ...fuzzyConflicts]
    setExactConflicts(newExactConflicts)

    const newRes = { ...conflictResolutions }
    fuzzyMatches.forEach((fm) => { if (fuzzyDecisions[fm.raw_row] !== 'same') delete newRes[fm.raw_row] })
    fuzzyConflicts.forEach((c) => {
      if (!newRes[c.raw_row]) newRes[c.raw_row] = { action: 'skip', existingId: c.existingId }
    })
    setConflictResolutions(newRes)

    if (newExactConflicts.length > 0) setStep('conflicts')
    else setStep('import')
  }

  // ── Import ────────────────────────────────────────────────────────────────────

  async function handleImport() {
    setImportProgress({ phase: 'preparing', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })

    const prep = await prepareBulkImportAction(validRows, conflictResolutions)
    if (prep.error) {
      toast.error(prep.error)
      setImportProgress({ phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })
      return
    }

    const { insertPayloads, upsertPayloads, skipped: serverSkipped } = prep

    if (!insertPayloads.length && !upsertPayloads.length) {
      await finalizeMedicinesImportAction()
      setResult({ inserted: 0, overwritten: 0, skipped: serverSkipped, errors: [] })
      setImportProgress({ phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })
      setStep('result')
      toast.info('All medicines already exist — nothing new to import')
      return
    }

    const insertChunks: Array<Record<string, unknown>[]> = []
    for (let i = 0; i < insertPayloads.length; i += BATCH_SIZE)
      insertChunks.push(insertPayloads.slice(i, i + BATCH_SIZE))

    const upsertChunks: Array<Record<string, unknown>[]> = []
    for (let i = 0; i < upsertPayloads.length; i += BATCH_SIZE)
      upsertChunks.push(upsertPayloads.slice(i, i + BATCH_SIZE))

    const totalBatches = insertChunks.length + upsertChunks.length
    setImportProgress({ phase: 'inserting', currentBatch: 0, totalBatches, insertedSoFar: 0 })

    let totalInserted = 0, totalOverwritten = 0, batchNum = 0
    const errors: string[] = []

    for (const batch of insertChunks) {
      const res = await insertMedicineBatchAction(batch)
      batchNum++
      if (res.error) errors.push(`Insert batch ${batchNum}: ${res.error}`)
      else totalInserted += res.inserted
      setImportProgress({ phase: 'inserting', currentBatch: batchNum, totalBatches, insertedSoFar: totalInserted })
    }

    for (const batch of upsertChunks) {
      const res = await upsertMedicineBatchAction(batch)
      batchNum++
      if (res.error) errors.push(`Update batch ${batchNum}: ${res.error}`)
      else totalOverwritten += res.updated
      setImportProgress({ phase: 'inserting', currentBatch: batchNum, totalBatches, insertedSoFar: totalInserted })
    }

    await finalizeMedicinesImportAction()
    setResult({ inserted: totalInserted, overwritten: totalOverwritten, skipped: serverSkipped, errors })
    setImportProgress({ phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })
    setStep('result')

    if (errors.length === 0) {
      const parts: string[] = []
      if (totalInserted > 0)    parts.push(`${totalInserted} added`)
      if (totalOverwritten > 0) parts.push(`${totalOverwritten} updated`)
      toast.success(parts.join(', ') + ' successfully')
    } else {
      toast.warning(`Import completed with ${errors.length} batch error(s)`)
    }
  }

  // ── Titles ────────────────────────────────────────────────────────────────────

  const dialogTitle: Record<Step, string> = {
    upload:   'Bulk Import Medicines',
    preview:  `File Preview — "${filename}"`,
    validate: `Validation — "${filename}"`,
    checking: 'Checking for duplicates…',
    fuzzy:    `Fuzzy Review — ${fuzzyMatches.length} possible match${fuzzyMatches.length === 1 ? '' : 'es'}`,
    conflicts:`Conflict Resolution — ${exactConflicts.length} conflict${exactConflicts.length === 1 ? '' : 's'}`,
    import:   isImporting
      ? importProgress.phase === 'preparing'
        ? 'Preparing import…'
        : `Importing — batch ${importProgress.currentBatch} of ${importProgress.totalBatches}`
      : `Preview — ${validRows.length.toLocaleString()} rows ready`,
    result:   'Import Complete',
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[88vh] flex flex-col gap-0 p-0">

        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0 space-y-4">
          <DialogTitle className="text-lg">{dialogTitle[step]}</DialogTitle>
          <StepIndicator current={step} steps={visibleSteps} />
        </DialogHeader>

        {step === 'upload' && (
          <UploadStep onFileLoaded={handleFileLoaded} />
        )}

        {step === 'preview' && (
          <PreviewStep
            rows={parsedRows}
            filename={filename}
            onBack={() => { setParsedRows([]); setFilename(''); setStep('upload') }}
            onNext={handleRunValidation}
          />
        )}

        {(step === 'validate' || step === 'checking') && (
          <ValidateStep
            allRows={allRows}
            filename={filename}
            onBack={() => setStep('preview')}
            onCheckDuplicates={handleCheckDuplicates}
          />
        )}

        {step === 'fuzzy' && (
          <FuzzyStep
            fuzzyMatches={fuzzyMatches}
            fuzzyDecisions={fuzzyDecisions}
            onChange={(rawRow, decision) =>
              setFuzzyDecisions((prev) => ({ ...prev, [rawRow]: decision }))
            }
            onBack={() => setStep('validate')}
            onNext={handleFuzzyNext}
          />
        )}

        {step === 'conflicts' && (
          <ConflictsStep
            exactConflicts={exactConflicts}
            conflictResolutions={conflictResolutions}
            onChange={(rawRow, action, existingId) =>
              setConflictResolutions((prev) => ({ ...prev, [rawRow]: { action, existingId } }))
            }
            onBack={() => setStep(fuzzyMatches.length > 0 ? 'fuzzy' : 'validate')}
            onNext={() => setStep('import')}
          />
        )}

        {step === 'import' && (
          <ImportPreviewStep
            validRows={validRows}
            exactConflicts={exactConflicts}
            conflictResolutions={conflictResolutions}
            skippedCount={skippedCount}
            isImporting={isImporting}
            importProgress={importProgress}
            onBack={() => setStep(exactConflicts.length > 0 ? 'conflicts' : 'validate')}
            onImport={handleImport}
          />
        )}

        {step === 'result' && result && (
          <ResultStep result={result} onClose={handleClose} />
        )}

      </DialogContent>
    </Dialog>
  )
}
```

---

## Task 11: Update `BulkImportButton` import

**Files:**
- Modify: `components/medicines/bulk-import-button.tsx`

Change line 4:
```typescript
// OLD:
import { BulkImportDialog } from './bulk-import-dialog'
// NEW:
import { BulkImportDialog } from './bulk-import'
```

---

## Task 12: Delete the old dialog file

**Step 1: Delete**

```bash
rm components/medicines/bulk-import-dialog.tsx
```

**Step 2: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors about missing `bulk-import-dialog`.

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: medicines bulk import v2 — excel template, preview step, all-rows validation"
```

---

## Visual Verification Checklist

After implementation, manually test these in the browser at `http://localhost:3002/medicines`:

1. Click **Import** button → dialog opens on Upload step
2. Click **Download Excel Template** → `medicines_import_template.xlsx` downloads
3. Open the template in Excel → Unit column shows dropdown, Status and Tax% columns show dropdowns
4. Drop/select an `.xlsx` file → moves to **Preview** step showing parsed rows table
5. Click **Run Validation →** → moves to **Validate** step
6. Verify: 4 summary cards show correct counts
7. Click **Errors** tab → only error rows shown with red ✗ badge + reason
8. Click **Duplicates** tab → only duplicate rows shown with amber ⚠ badge
9. Click **Valid** tab → only valid rows shown with green ✓ badge
10. Click **Check for Conflicts →** → proceeds through existing fuzzy/conflict/import/result flow
11. Import completes → progress bar advances batch-by-batch → result step shows stats
