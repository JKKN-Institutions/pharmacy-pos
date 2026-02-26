'use client'

import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Info,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  parseMedicinesFile,
  type ParsedMedicineRow,
} from '@/lib/utils/parse-medicines-excel'
import {
  prepareBulkImportAction,
  insertMedicineBatchAction,
  finalizeMedicinesImportAction,
} from '@/app/(dashboard)/medicines/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'validate' | 'preview' | 'result'

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload',   label: 'Upload'   },
  { key: 'validate', label: 'Validate' },
  { key: 'preview',  label: 'Preview'  },
  { key: 'result',   label: 'Done'     },
]

type ImportPhase = 'idle' | 'preparing' | 'inserting'

interface ImportProgress {
  phase: ImportPhase
  currentBatch: number
  totalBatches: number
  insertedSoFar: number
}

interface RowValidation {
  row: ParsedMedicineRow
  status: 'valid' | 'duplicate' | 'error'
  reason?: string
}

interface ImportResult {
  inserted: number
  skipped: number
  errors: string[]
}

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const BATCH_SIZE = 200

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current)
  return (
    <div className="flex items-start">
      {STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx
        const isActive    = idx === currentIdx
        return (
          <div key={step.key} className="flex items-start">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors
                  ${isCompleted
                    ? 'bg-primary border-primary text-primary-foreground'
                    : isActive
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-border text-muted-foreground bg-background'
                  }`}
              >
                {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
              </div>
              <span
                className={`text-[11px] font-medium whitespace-nowrap
                  ${isActive ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-14 mt-3.5 mx-1.5 shrink-0 transition-colors
                  ${idx < currentIdx ? 'bg-primary' : 'bg-border'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Progress bar (inline, no extra shadcn component needed) ─────────────────

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

// ─── Main dialog ──────────────────────────────────────────────────────────────

export function BulkImportDialog({ open, onOpenChange }: BulkImportDialogProps) {
  const [step,           setStep          ] = useState<Step>('upload')
  const [allRows,        setAllRows       ] = useState<RowValidation[]>([])
  const [filename,       setFilename      ] = useState('')
  const [dragOver,       setDragOver      ] = useState(false)
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0,
  })
  const [result,         setResult        ] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Derived slices
  const validRows     = allRows.filter((r) => r.status === 'valid').map((r) => r.row)
  const errorRows     = allRows.filter((r) => r.status === 'error')
  const duplicateRows = allRows.filter((r) => r.status === 'duplicate')
  const skippedCount  = errorRows.length + duplicateRows.length
  const hasLiveStock  = validRows.some((r) => r.live_stock !== null)
  const isImporting   = importProgress.phase !== 'idle'

  const progressPct =
    importProgress.phase === 'inserting' && importProgress.totalBatches > 0
      ? Math.round((importProgress.currentBatch / importProgress.totalBatches) * 100)
      : 0

  function handleClose() {
    if (isImporting) return        // block close while batches are running
    onOpenChange(false)
    setTimeout(() => {
      setStep('upload')
      setAllRows([])
      setFilename('')
      setResult(null)
      setImportProgress({ phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })
    }, 300)
  }

  // ── File parsing + client-side validation ───────────────────────────────────
  async function processFile(file: File) {
    const buffer = await file.arrayBuffer()
    try {
      const parsed = parseMedicinesFile(buffer, file.name)
      if (!parsed.length) {
        toast.error('No valid medicine rows found in the file')
        return
      }

      const seenNames = new Set<string>()
      const validated: RowValidation[] = parsed.map((row) => {
        if (!row.name || row.name.length < 2)
          return { row, status: 'error', reason: 'Name too short or missing' }
        const key = row.name.toLowerCase().trim()
        if (seenNames.has(key))
          return { row, status: 'duplicate', reason: 'Duplicate within this file' }
        seenNames.add(key)
        return { row, status: 'valid' }
      })

      setFilename(file.name)
      setAllRows(validated)
      setStep('validate')
    } catch (e) {
      toast.error('Failed to parse file: ' + (e as Error).message)
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

  // ── Import: prepare → batch loop → finalize ─────────────────────────────────
  async function handleImport() {
    // Phase 1: prepare (categories + dedup against DB)
    setImportProgress({ phase: 'preparing', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })

    const prep = await prepareBulkImportAction(validRows)
    if (prep.error) {
      toast.error(prep.error)
      setImportProgress({ phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })
      return
    }

    const { payloads, skipped: serverSkipped } = prep

    if (!payloads.length) {
      await finalizeMedicinesImportAction()
      setResult({ inserted: 0, skipped: serverSkipped, errors: [] })
      setImportProgress({ phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })
      setStep('result')
      toast.info('All medicines already exist — nothing new to import')
      return
    }

    // Phase 2: insert in BATCH_SIZE chunks, updating progress after each await
    const chunks: Array<Record<string, unknown>[]> = []
    for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
      chunks.push(payloads.slice(i, i + BATCH_SIZE))
    }

    setImportProgress({ phase: 'inserting', currentBatch: 0, totalBatches: chunks.length, insertedSoFar: 0 })

    let totalInserted = 0
    const errors: string[] = []

    for (let i = 0; i < chunks.length; i++) {
      const res = await insertMedicineBatchAction(chunks[i])
      if (res.error) {
        errors.push(`Batch ${i + 1}: ${res.error}`)
      } else {
        totalInserted += res.inserted
      }
      // Each setState after an await triggers its own render → real progress updates
      setImportProgress({
        phase: 'inserting',
        currentBatch: i + 1,
        totalBatches: chunks.length,
        insertedSoFar: totalInserted,
      })
    }

    await finalizeMedicinesImportAction()

    setResult({ inserted: totalInserted, skipped: serverSkipped, errors })
    setImportProgress({ phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })
    setStep('result')

    if (errors.length === 0) {
      toast.success(`${totalInserted} medicines imported successfully`)
    } else {
      toast.warning(`Import completed with ${errors.length} batch error(s)`)
    }
  }

  function downloadTemplate() {
    const headers = ['Medicine', 'Company', 'Unit', 'Unit/Packing', 'Category', 'Storebox', 'Reorderlevel', 'Status']
    const example = ['PARACETAMOL 500MG TAB', 'Cipla', '10', 'Strip of 10', 'Tablet', 'Rack A', '20', 'Normal']
    const csv = [headers.join(','), example.join(',')].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'medicines_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[88vh] flex flex-col gap-0 p-0">

        {/* ── Shared header ────────────────────────────────────────────────── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0 space-y-4">
          <DialogTitle className="text-lg">
            {step === 'upload'   && 'Bulk Import Medicines'}
            {step === 'validate' && `Validation — "${filename}"`}
            {step === 'preview'  && (isImporting
              ? importProgress.phase === 'preparing'
                ? 'Preparing import…'
                : `Importing — batch ${importProgress.currentBatch} of ${importProgress.totalBatches}`
              : `Preview — ${validRows.length.toLocaleString()} rows ready`)}
            {step === 'result'   && 'Import Complete'}
          </DialogTitle>
          <StepIndicator current={step} />
        </DialogHeader>

        {/* ── Step 1: Upload ───────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="px-6 py-5 space-y-5 overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              Upload an Excel (.xlsx / .xls) or CSV file. The system will
              automatically de-duplicate names, create missing categories, and
              skip medicines that already exist in the catalogue.
            </p>

            <div
              className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer select-none
                ${dragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40 hover:bg-muted/30'
                }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">Drop your Excel or CSV file here</p>
              <p className="text-xs text-muted-foreground">Supports .xlsx, .xls, .csv</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

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
                * required &nbsp;·&nbsp; Other columns (like "Live Stock", "#") are recognised
                and shown in preview but not imported.
              </p>
            </div>

            <Button variant="outline" size="sm" className="w-full" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download CSV Template
            </Button>
          </div>
        )}

        {/* ── Step 2: Validate ─────────────────────────────────────────────── */}
        {step === 'validate' && (
          <div className="flex flex-col min-h-0 flex-1">
            <div className="px-6 py-4 space-y-3 flex-shrink-0">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{allRows.length.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Rows Parsed</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {validRows.length.toLocaleString()}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">Ready to Import</p>
                </div>
                <div
                  className={`rounded-lg border p-3 text-center
                    ${skippedCount > 0
                      ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800'
                      : 'border-border'
                    }`}
                >
                  <p className={`text-2xl font-bold ${skippedCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
                    {skippedCount.toLocaleString()}
                  </p>
                  <p className={`text-xs mt-0.5 ${skippedCount > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'}`}>
                    Skipped
                  </p>
                </div>
              </div>

              {skippedCount === 0 && (
                <Alert className="py-2 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-xs text-emerald-700 dark:text-emerald-300">
                    All {allRows.length.toLocaleString()} rows passed validation. Proceed to preview.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {skippedCount > 0 && (
              <div className="flex-1 overflow-auto border-t border-b">
                <Table>
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-muted/80 hover:bg-muted/80 backdrop-blur">
                      <TableHead className="text-xs pl-6 w-14">Row</TableHead>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Issue</TableHead>
                      <TableHead className="text-xs pr-6">Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...errorRows, ...duplicateRows].map((rv) => (
                      <TableRow key={rv.row.raw_row} className="border-b border-border/40">
                        <TableCell className="text-xs text-muted-foreground pl-6">
                          {rv.row.raw_row}
                        </TableCell>
                        <TableCell className="text-xs font-medium max-w-[260px]">
                          <div className="truncate">{rv.row.name}</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{rv.reason}</TableCell>
                        <TableCell className="pr-6">
                          <Badge
                            variant="outline"
                            className={
                              rv.status === 'error'
                                ? 'text-xs border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-400'
                                : 'text-xs border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                            }
                          >
                            {rv.status === 'error' ? 'Error' : 'Duplicate'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="px-6 py-4 flex items-center justify-between flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => { setStep('upload'); setAllRows([]); setFilename('') }}
              >
                Back
              </Button>
              <Button disabled={validRows.length === 0} onClick={() => setStep('preview')}>
                Preview {validRows.length.toLocaleString()} rows →
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Preview (+ importing overlay) ────────────────────────── */}
        {step === 'preview' && (
          <div className="flex flex-col min-h-0 flex-1">

            {/* ── Importing state — replaces table while batches run ── */}
            {isImporting ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 py-10">
                {/* Animated icon */}
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="w-9 h-9 text-primary" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-background border-2 border-border flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  </div>
                </div>

                {/* Phase label */}
                <div className="text-center space-y-1.5 w-full max-w-xs">
                  <p className="text-base font-semibold">
                    {importProgress.phase === 'preparing'
                      ? 'Preparing import…'
                      : 'Inserting medicines…'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {importProgress.phase === 'preparing'
                      ? 'Setting up categories and checking for duplicates'
                      : `${importProgress.insertedSoFar.toLocaleString()} medicines inserted · batch ${importProgress.currentBatch} of ${importProgress.totalBatches}`}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full max-w-xs space-y-2">
                  <ProgressBar
                    value={progressPct}
                    indeterminate={importProgress.phase === 'preparing'}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {importProgress.phase === 'preparing'
                        ? 'Please wait…'
                        : `${progressPct}% complete`}
                    </span>
                    {importProgress.phase === 'inserting' && (
                      <span>
                        {importProgress.currentBatch} / {importProgress.totalBatches} batches
                      </span>
                    )}
                  </div>
                </div>

                {/* Batch pills */}
                {importProgress.phase === 'inserting' && importProgress.totalBatches > 1 && (
                  <div className="flex flex-wrap justify-center gap-1.5 max-w-sm">
                    {Array.from({ length: importProgress.totalBatches }, (_, i) => (
                      <div
                        key={i}
                        className={`w-5 h-5 rounded text-[10px] font-semibold flex items-center justify-center transition-colors
                          ${i < importProgress.currentBatch
                            ? 'bg-primary text-primary-foreground'
                            : i === importProgress.currentBatch
                            ? 'bg-primary/30 text-primary border border-primary/40'
                            : 'bg-muted text-muted-foreground'
                          }`}
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            ) : (
              /* ── Normal preview (table + footer) ── */
              <>
                <div className="px-6 py-4 space-y-3 flex-shrink-0">
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        {validRows.length.toLocaleString()} rows ready to import
                      </span>
                    </div>
                    {skippedCount > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span className="text-sm text-amber-700 dark:text-amber-400">
                          {skippedCount} rows skipped
                        </span>
                      </div>
                    )}
                  </div>

                  {hasLiveStock && (
                    <Alert className="py-2.5">
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-xs leading-relaxed">
                        <strong>Live Stock column detected but not imported.</strong>{' '}
                        Stock data belongs in <strong>Purchases</strong> (with batch number +
                        expiry date). Add purchases after importing the medicine catalogue.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="flex-1 overflow-auto border-t border-b">
                  <Table>
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow className="bg-muted/80 hover:bg-muted/80 backdrop-blur">
                        <TableHead className="text-xs pl-6 w-12">#</TableHead>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Company</TableHead>
                        <TableHead className="text-xs">Category</TableHead>
                        <TableHead className="text-xs">Unit</TableHead>
                        <TableHead className="text-xs text-right">Reorder</TableHead>
                        {hasLiveStock && (
                          <TableHead className="text-xs text-right text-muted-foreground">
                            Live Stock*
                          </TableHead>
                        )}
                        <TableHead className="text-xs pr-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validRows.slice(0, 50).map((row) => (
                        <TableRow key={row.raw_row} className="border-b border-border/40">
                          <TableCell className="text-xs text-muted-foreground pl-6">
                            {row.raw_row}
                          </TableCell>
                          <TableCell className="text-xs font-medium max-w-[220px]">
                            <div className="truncate">{row.name}</div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {row.company ?? '—'}
                          </TableCell>
                          <TableCell className="text-xs">{row.category ?? '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {row.unit ?? '—'}
                          </TableCell>
                          <TableCell className="text-xs text-right text-muted-foreground">
                            {row.reorder_level}
                          </TableCell>
                          {hasLiveStock && (
                            <TableCell className="text-xs text-right text-muted-foreground/60">
                              {row.live_stock ?? '—'}
                            </TableCell>
                          )}
                          <TableCell className="pr-6">
                            <Badge
                              variant="outline"
                              className={
                                row.status === 'active'
                                  ? 'text-xs border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                  : 'text-xs'
                              }
                            >
                              {row.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {validRows.length > 50 && (
                    <div className="px-6 py-3 text-xs text-center text-muted-foreground bg-muted/20 border-t">
                      Showing first 50 of{' '}
                      <strong>{validRows.length.toLocaleString()}</strong> rows — all rows will
                      be imported
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 flex items-center justify-between flex-shrink-0">
                  <Button variant="outline" onClick={() => setStep('validate')}>
                    Back
                  </Button>
                  <Button onClick={handleImport}>
                    <Upload className="w-4 h-4 mr-2" />
                    Import {validRows.length.toLocaleString()} medicines
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 4: Result ───────────────────────────────────────────────── */}
        {step === 'result' && result && (
          <div className="px-6 py-6 space-y-5 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border p-5 text-center space-y-1">
                <p className="text-4xl font-bold text-emerald-600">
                  {result.inserted.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Medicines Imported</p>
              </div>
              <div className="rounded-xl border p-5 text-center space-y-1">
                <p className="text-4xl font-bold text-muted-foreground">
                  {result.skipped.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Skipped (already exist)</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-1.5">
                    {result.errors.length} batch error(s) occurred:
                  </p>
                  <ul className="text-xs space-y-0.5">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {result.errors.length === 0 && (
              <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertDescription className="text-emerald-700 dark:text-emerald-300">
                  All medicines imported successfully. The catalogue has been updated and the
                  medicines page is refreshed.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setStep('upload')
                  setAllRows([])
                  setFilename('')
                  setResult(null)
                }}
              >
                Import Another File
              </Button>
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
