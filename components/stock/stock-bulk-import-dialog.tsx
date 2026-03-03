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
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { parseStockBatchesFile, type ParsedStockBatchRow } from '@/lib/utils/parse-stock-batches-excel'
import {
  prepareStockBatchImportAction,
  insertStockBatchAction,
  finalizeStockImportAction,
} from '@/app/(dashboard)/stock/actions'
import { formatINR } from '@/lib/utils/currency'
import { format } from 'date-fns'

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
  phase:          ImportPhase
  currentBatch:   number
  totalBatches:   number
  insertedSoFar:  number
}

interface RowValidation {
  row:    ParsedStockBatchRow
  status: 'valid' | 'error'
  reason?: string
}

interface ImportResult {
  inserted:  number
  skipped:   number
  notFound:  string[]
  errors:    string[]
}

interface Props {
  open:         boolean
  onOpenChange: (open: boolean) => void
}

const BATCH_SIZE = 100

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
              <span className={`text-[11px] font-medium whitespace-nowrap
                ${isActive ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-0.5 w-14 mt-3.5 mx-1.5 shrink-0 transition-colors
                ${idx < currentIdx ? 'bg-primary' : 'bg-border'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

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

export function StockBulkImportDialog({ open, onOpenChange }: Props) {
  const [step,             setStep            ] = useState<Step>('upload')
  const [allRows,   setAllRows ] = useState<RowValidation[]>([])
  const [filename,  setFilename] = useState('')
  const [dragOver,         setDragOver        ] = useState(false)
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0,
  })
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const validRows    = allRows.filter((r) => r.status === 'valid').map((r) => r.row)
  const errorRows    = allRows.filter((r) => r.status === 'error')
  const isImporting  = importProgress.phase !== 'idle'

  const progressPct =
    importProgress.phase === 'inserting' && importProgress.totalBatches > 0
      ? Math.round((importProgress.currentBatch / importProgress.totalBatches) * 100)
      : 0

  function handleClose() {
    if (isImporting) return
    onOpenChange(false)
    setTimeout(() => {
      setStep('upload')
      setAllRows([])
      setFilename('')
      setResult(null)
      setImportProgress({ phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })
    }, 300)
  }

  // ── File parsing + client-side validation ────────────────────────────────────
  async function processFile(file: File) {
    const buffer = await file.arrayBuffer()
    try {
      const { rows: parsed } = parseStockBatchesFile(buffer, file.name)
      if (!parsed.length) {
        toast.error('No valid stock batch rows found in the file')
        return
      }

      const validated: RowValidation[] = parsed.map((row) => {
        if (!row.medicine_name || row.medicine_name.length < 2)
          return { row, status: 'error', reason: 'Medicine name missing or too short' }
        if (!row.batch_number)
          return { row, status: 'error', reason: 'Batch number missing' }
        if (!row.expiry_date)
          return { row, status: 'error', reason: 'Could not parse expiry date' }
        if (row.qty <= 0)
          return { row, status: 'error', reason: 'Quantity must be > 0' }
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

  // ── Import: prepare → batch loop → finalize ──────────────────────────────────
  async function handleImport() {
    setImportProgress({ phase: 'preparing', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })

    const prep = await prepareStockBatchImportAction(validRows)
    if (prep.error) {
      toast.error(prep.error)
      setImportProgress({ phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })
      return
    }

    const { payloads, skipped: serverSkipped, notFound } = prep

    if (!payloads.length) {
      await finalizeStockImportAction()
      setResult({ inserted: 0, skipped: serverSkipped, notFound, errors: [] })
      setImportProgress({ phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })
      setStep('result')
      toast.info('All batches already exist or medicines not found — nothing imported')
      return
    }

    const chunks: Array<Record<string, unknown>[]> = []
    for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
      chunks.push(payloads.slice(i, i + BATCH_SIZE))
    }

    setImportProgress({ phase: 'inserting', currentBatch: 0, totalBatches: chunks.length, insertedSoFar: 0 })

    let totalInserted = 0
    const errors: string[] = []

    for (let i = 0; i < chunks.length; i++) {
      const res = await insertStockBatchAction(chunks[i])
      if (res.error) {
        errors.push(`Batch ${i + 1}: ${res.error}`)
      } else {
        totalInserted += res.inserted
      }
      setImportProgress({
        phase: 'inserting',
        currentBatch: i + 1,
        totalBatches: chunks.length,
        insertedSoFar: totalInserted,
      })
    }

    await finalizeStockImportAction()

    setResult({ inserted: totalInserted, skipped: serverSkipped, notFound, errors })
    setImportProgress({ phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })
    setStep('result')

    if (errors.length === 0) {
      toast.success(`${totalInserted} stock batches imported successfully`)
    } else {
      toast.warning(`Import completed with ${errors.length} batch error(s)`)
    }
  }

  function downloadTemplate() {
    const headers = ['Name', 'Batch', 'Expiry', 'Purchase Price', 'Sale Price', 'Qty', 'Sold', 'Available']
    const example = ['PARACETAMOL 500MG TAB', 'BN240001', '12/2026', '42.50', '68.00', '100', '25', '75']
    const csv = [headers.join(','), example.join(',')].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'stock_batches_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[88vh] flex flex-col gap-0 p-0">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0 space-y-4">
          <DialogTitle className="text-lg">
            {step === 'upload'   && 'Import Stock Batches'}
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

        {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="px-6 py-5 space-y-5 overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              Upload an Excel (.xlsx / .xls) or CSV file containing stock batch
              data. Medicine names must match the existing medicine catalogue exactly.
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
                  { label: 'Name',           required: true  },
                  { label: 'Batch',          required: true  },
                  { label: 'Expiry',         required: true  },
                  { label: 'Purchase Price', required: true  },
                  { label: 'Sale Price',     required: true  },
                  { label: 'Qty',            required: true  },
                  { label: 'Sold',           required: false },
                  { label: 'Available',      required: false },
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
                * required &nbsp;·&nbsp; Expiry: DD/MM/YYYY, MM/YYYY, or YYYY-MM-DD &nbsp;·&nbsp; Sold &amp; Available default to 0 / Qty if omitted
              </p>
            </div>

            <Button variant="outline" size="sm" className="w-full" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download CSV Template
            </Button>
          </div>
        )}

        {/* ── Step 2: Validate ───────────────────────────────────────────── */}
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
                <div className={`rounded-lg border p-3 text-center
                  ${errorRows.length > 0
                    ? 'border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-800'
                    : 'border-border'
                  }`}>
                  <p className={`text-2xl font-bold ${errorRows.length > 0 ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'}`}>
                    {errorRows.length.toLocaleString()}
                  </p>
                  <p className={`text-xs mt-0.5 ${errorRows.length > 0 ? 'text-red-600 dark:text-red-500' : 'text-muted-foreground'}`}>
                    Errors
                  </p>
                </div>
              </div>

              {errorRows.length === 0 && (
                <Alert className="py-2 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-xs text-emerald-700 dark:text-emerald-300">
                    All {allRows.length.toLocaleString()} rows passed validation. Proceed to preview.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {errorRows.length > 0 && (
              <div className="flex-1 overflow-auto border-t border-b">
                <Table>
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-muted/80 hover:bg-muted/80 backdrop-blur">
                      <TableHead className="text-xs pl-6 w-14">Row</TableHead>
                      <TableHead className="text-xs">Medicine</TableHead>
                      <TableHead className="text-xs">Batch</TableHead>
                      <TableHead className="text-xs">Issue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errorRows.map((rv) => (
                      <TableRow key={rv.row.raw_row} className="border-b border-border/40">
                        <TableCell className="text-xs text-muted-foreground pl-6">{rv.row.raw_row}</TableCell>
                        <TableCell className="text-xs font-medium max-w-[180px]">
                          <div className="truncate">{rv.row.medicine_name}</div>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{rv.row.batch_number || '—'}</TableCell>
                        <TableCell className="text-xs text-red-600 dark:text-red-400">{rv.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="px-6 py-4 flex items-center justify-between flex-shrink-0">
              <Button variant="outline" onClick={() => { setStep('upload'); setAllRows([]); setFilename('') }}>
                Back
              </Button>
              <Button disabled={validRows.length === 0} onClick={() => setStep('preview')}>
                Preview {validRows.length.toLocaleString()} rows →
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Preview (+ importing overlay) ──────────────────────── */}
        {step === 'preview' && (
          <div className="flex flex-col min-h-0 flex-1">
            {isImporting ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 py-10">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="w-9 h-9 text-primary" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-background border-2 border-border flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  </div>
                </div>
                <div className="text-center space-y-1.5 w-full max-w-xs">
                  <p className="text-base font-semibold">
                    {importProgress.phase === 'preparing' ? 'Preparing import…' : 'Inserting batches…'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {importProgress.phase === 'preparing'
                      ? 'Matching medicines and checking duplicates'
                      : `${importProgress.insertedSoFar.toLocaleString()} batches inserted · ${importProgress.currentBatch} of ${importProgress.totalBatches}`}
                  </p>
                </div>
                <div className="w-full max-w-xs space-y-2">
                  <ProgressBar value={progressPct} indeterminate={importProgress.phase === 'preparing'} />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{importProgress.phase === 'preparing' ? 'Please wait…' : `${progressPct}% complete`}</span>
                    {importProgress.phase === 'inserting' && (
                      <span>{importProgress.currentBatch} / {importProgress.totalBatches} batches</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 flex-shrink-0">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 w-fit">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      {validRows.length.toLocaleString()} rows ready to import
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-auto border-t border-b">
                  <Table>
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow className="bg-muted/80 hover:bg-muted/80 backdrop-blur">
                        <TableHead className="text-xs pl-6 w-10">#</TableHead>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Batch</TableHead>
                        <TableHead className="text-xs">Expiry</TableHead>
                        <TableHead className="text-xs text-right">Purchase</TableHead>
                        <TableHead className="text-xs text-right">Sale</TableHead>
                        <TableHead className="text-xs text-right">Qty</TableHead>
                        <TableHead className="text-xs text-right">Sold</TableHead>
                        <TableHead className="text-xs text-right pr-6">Available</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validRows.slice(0, 50).map((row) => (
                        <TableRow key={row.raw_row} className="border-b border-border/40">
                          <TableCell className="text-xs text-muted-foreground pl-6">{row.raw_row}</TableCell>
                          <TableCell className="text-xs font-medium max-w-[160px]">
                            <div className="truncate">{row.medicine_name}</div>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{row.batch_number}</TableCell>
                          <TableCell className="text-xs">
                            {format(new Date(row.expiry_date), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {formatINR(row.purchase_price)}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {formatINR(row.selling_price)}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {row.qty}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                            {row.sold}
                          </TableCell>
                          <TableCell className="text-xs text-right font-semibold tabular-nums pr-6">
                            {row.available}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {validRows.length > 50 && (
                    <div className="px-6 py-3 text-xs text-center text-muted-foreground bg-muted/20 border-t">
                      Showing first 50 of{' '}
                      <strong>{validRows.length.toLocaleString()}</strong> rows — all rows will be imported
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 flex items-center justify-between flex-shrink-0">
                  <Button variant="outline" onClick={() => setStep('validate')}>Back</Button>
                  <Button onClick={handleImport}>
                    <Upload className="w-4 h-4 mr-2" />
                    Import {validRows.length.toLocaleString()} batches
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 4: Result ─────────────────────────────────────────────── */}
        {step === 'result' && result && (
          <div className="px-6 py-6 space-y-5 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border p-5 text-center space-y-1">
                <p className="text-4xl font-bold text-emerald-600">{result.inserted.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Batches Imported</p>
              </div>
              <div className="rounded-xl border p-5 text-center space-y-1">
                <p className="text-4xl font-bold text-muted-foreground">{result.skipped.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Skipped</p>
              </div>
            </div>

            {result.notFound.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-1.5">
                    {result.notFound.length} medicine{result.notFound.length !== 1 ? 's' : ''} could not be auto-created (insert failed):
                  </p>
                  <ul className="text-xs space-y-0.5 max-h-24 overflow-y-auto">
                    {result.notFound.map((n, i) => <li key={i} className="font-mono">{n}</li>)}
                  </ul>
                  <p className="text-xs mt-2 opacity-80">
                    These batches were skipped. Check for special characters or try re-importing.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-1.5">{result.errors.length} insert error(s):</p>
                  <ul className="text-xs space-y-0.5">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {result.errors.length === 0 && result.notFound.length === 0 && (
              <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertDescription className="text-emerald-700 dark:text-emerald-300">
                  All batches imported successfully. The stock page has been refreshed.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => { setStep('upload'); setAllRows([]); setFilename(''); setResult(null) }}
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
