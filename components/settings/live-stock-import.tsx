'use client'

import { useState, useRef } from 'react'
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
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Loader2,
  Package,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { parseLiveStockFile, type ParseLiveStockResult } from '@/lib/utils/parse-live-stock-json'
import {
  cleanWipeForReimportAction,
  prepareStockBatchImportAction,
  insertStockBatchAction,
  finalizeStockImportAction,
} from '@/app/(dashboard)/stock/actions'
import { formatINR } from '@/lib/utils/currency'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'validate' | 'preview' | 'result'

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload',   label: 'Upload'   },
  { key: 'validate', label: 'Validate' },
  { key: 'preview',  label: 'Preview'  },
  { key: 'result',   label: 'Done'     },
]

type ImportPhase = 'idle' | 'wiping' | 'preparing' | 'inserting'

interface ImportProgress {
  phase:         ImportPhase
  currentBatch:  number
  totalBatches:  number
  insertedSoFar: number
}

interface ImportResult {
  inserted:  number
  skipped:   number
  notFound:  string[]
  errors:    string[]
  medicines: number
}

const BATCH_SIZE = 100

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current)
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx
        const isActive = idx === currentIdx
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1">
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
              <div className={`h-0.5 w-10 mt-[-14px] mx-0.5 shrink-0 transition-colors
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

// ─── Main component ───────────────────────────────────────────────────────────

export function LiveStockImport() {
  const [step, setStep] = useState<Step>('upload')
  const [parseResult, setParseResult] = useState<ParseLiveStockResult | null>(null)
  const [filename, setFilename] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0,
  })
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const validRows = parseResult?.rows ?? []
  const isImporting = importProgress.phase !== 'idle'

  const progressPct =
    importProgress.phase === 'inserting' && importProgress.totalBatches > 0
      ? Math.round((importProgress.currentBatch / importProgress.totalBatches) * 100)
      : 0

  function resetState() {
    setStep('upload')
    setParseResult(null)
    setFilename('')
    setResult(null)
    setImportProgress({ phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })
  }

  // ── File parsing ────────────────────────────────────────────────────────────
  async function processFile(file: File) {
    try {
      const lname = file.name.toLowerCase()

      let parsed: ParseLiveStockResult

      if (lname.endsWith('.json')) {
        const text = await file.text()
        const data = JSON.parse(text)
        parsed = parseLiveStockFile(data, file.name)
      } else {
        // .xlsx, .xls, .csv
        const buffer = await file.arrayBuffer()
        parsed = parseLiveStockFile(buffer, file.name)
      }

      if (parsed.rows.length === 0) {
        toast.error('No valid stock records found in the file')
        return
      }

      setFilename(file.name)
      setParseResult(parsed)
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

  // ── Import: wipe → prepare → batch loop → finalize ──────────────────────────
  async function handleImport() {
    // Step 0: Wipe existing data for clean re-import
    setImportProgress({ phase: 'wiping', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })

    const wipe = await cleanWipeForReimportAction()
    if (wipe.error) {
      toast.error(wipe.error)
      setImportProgress({ phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })
      return
    }

    // Step 1: Prepare payloads (auto-creates medicines)
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
      setResult({ inserted: 0, skipped: serverSkipped, notFound, errors: [], medicines: 0 })
      setImportProgress({ phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })
      setStep('result')
      toast.info('Nothing to import — all rows were skipped')
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

    setResult({
      inserted: totalInserted,
      skipped: serverSkipped,
      notFound,
      errors,
      medicines: parseResult?.stats.uniqueMedicines ?? 0,
    })
    setImportProgress({ phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })
    setStep('result')

    if (errors.length === 0) {
      toast.success(`${totalInserted} stock batches imported successfully`)
    } else {
      toast.warning(`Import completed with ${errors.length} error(s)`)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <StepIndicator current={step} />

      {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload the <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Live_Stock_Pharmacy_Management.xlsx</code> export
            from your legacy system. This will create medicines in the catalog and import all stock batches with corrected quantities.
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
            <p className="text-sm font-medium mb-1">Drop your Excel or JSON file here</p>
            <p className="text-xs text-muted-foreground">Supports .xlsx, .xls, .csv, .json</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.json"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Expected columns
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['#', 'Name', 'Batch', 'Expiry', 'Purchase Price', 'Sale Price', 'Qty', 'Sold', 'current stock'].map((col) => (
                <span
                  key={col}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border bg-muted/50 border-border text-muted-foreground"
                >
                  {col}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Expiry format: MM-YYYY (e.g. 01-2027) &middot; Prices can include ₹ symbol
            </p>
          </div>

          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/10">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
              <strong>Data correction:</strong> Where <code>Qty - Sold &ne; current stock</code> (30% of records),
              the importer trusts <code>current stock</code> as the real available quantity and back-calculates
              <code> sold = Qty - current stock</code>.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* ── Step 2: Validate ───────────────────────────────────────────── */}
      {step === 'validate' && parseResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{parseResult.stats.total.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total Records</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {parseResult.stats.valid.toLocaleString()}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">Ready to Import</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {parseResult.stats.uniqueMedicines.toLocaleString()}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">Unique Medicines</p>
            </div>
            <div className={`rounded-lg border p-3 text-center
              ${parseResult.stats.skipped > 0
                ? 'border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-800'
                : 'border-border'
              }`}>
              <p className={`text-2xl font-bold ${parseResult.stats.skipped > 0 ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'}`}>
                {parseResult.stats.skipped.toLocaleString()}
              </p>
              <p className={`text-xs mt-0.5 ${parseResult.stats.skipped > 0 ? 'text-red-600 dark:text-red-500' : 'text-muted-foreground'}`}>
                Errors
              </p>
            </div>
          </div>

          {/* Data correction info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    {parseResult.stats.soldCorrected.toLocaleString()}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">Sold qty corrected</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{parseResult.stats.zeroStock.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Zero-stock batches</p>
                </div>
              </div>
            </div>
          </div>

          {parseResult.stats.skipped === 0 && (
            <Alert className="py-2 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-xs text-emerald-700 dark:text-emerald-300">
                All {parseResult.stats.total.toLocaleString()} records passed validation. Proceed to preview.
              </AlertDescription>
            </Alert>
          )}

          {/* Error rows table */}
          {parseResult.skippedRows.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-red-50 dark:bg-red-950/40 border-b text-xs font-medium text-red-700 dark:text-red-400">
                Skipped rows ({parseResult.skippedRows.length})
              </div>
              <div className="max-h-48 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-xs w-14">Row</TableHead>
                      <TableHead className="text-xs">Medicine</TableHead>
                      <TableHead className="text-xs">Issue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parseResult.skippedRows.map((sr) => (
                      <TableRow key={sr.row}>
                        <TableCell className="text-xs text-muted-foreground">{sr.row}</TableCell>
                        <TableCell className="text-xs font-medium">{sr.name}</TableCell>
                        <TableCell className="text-xs text-red-600 dark:text-red-400">{sr.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={resetState}>Back</Button>
            <Button disabled={validRows.length === 0} onClick={() => setStep('preview')}>
              Preview {validRows.length.toLocaleString()} rows
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview + Import ───────────────────────────────────── */}
      {step === 'preview' && (
        <div className="space-y-4">
          {isImporting ? (
            <div className="flex flex-col items-center justify-center gap-6 py-10">
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
                  {importProgress.phase === 'wiping' && 'Cleaning existing data...'}
                  {importProgress.phase === 'preparing' && 'Preparing import...'}
                  {importProgress.phase === 'inserting' && 'Inserting batches...'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {importProgress.phase === 'wiping'
                    ? 'Removing old stock batches (purchases not affected)'
                    : importProgress.phase === 'preparing'
                    ? 'Creating medicines and matching records'
                    : `${importProgress.insertedSoFar.toLocaleString()} batches inserted`}
                </p>
              </div>
              <div className="w-full max-w-xs space-y-2">
                <ProgressBar value={progressPct} indeterminate={importProgress.phase !== 'inserting'} />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{importProgress.phase === 'inserting' ? `${progressPct}% complete` : 'Please wait...'}</span>
                  {importProgress.phase === 'inserting' && (
                    <span>{importProgress.currentBatch} / {importProgress.totalBatches} batches</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 w-fit">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  {validRows.length.toLocaleString()} batch records + {parseResult?.stats.uniqueMedicines.toLocaleString()} medicines ready
                </span>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-80 overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow className="bg-muted/80 hover:bg-muted/80 backdrop-blur">
                        <TableHead className="text-xs w-10">#</TableHead>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Batch</TableHead>
                        <TableHead className="text-xs">Expiry</TableHead>
                        <TableHead className="text-xs text-right">Purchase</TableHead>
                        <TableHead className="text-xs text-right">Sale</TableHead>
                        <TableHead className="text-xs text-right">Qty</TableHead>
                        <TableHead className="text-xs text-right">Sold</TableHead>
                        <TableHead className="text-xs text-right">Available</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validRows.slice(0, 50).map((row) => (
                        <TableRow key={row.raw_row} className="border-b border-border/40">
                          <TableCell className="text-xs text-muted-foreground">{row.raw_row}</TableCell>
                          <TableCell className="text-xs font-medium max-w-[160px]">
                            <div className="truncate">{row.medicine_name}</div>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{row.batch_number}</TableCell>
                          <TableCell className="text-xs">{row.expiry_date}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{formatINR(row.purchase_price)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{formatINR(row.selling_price)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{row.qty}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums text-muted-foreground">{row.sold}</TableCell>
                          <TableCell className="text-xs text-right font-semibold tabular-nums">
                            <Badge variant={row.available > 0 ? 'outline' : 'secondary'} className="text-xs tabular-nums">
                              {row.available}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {validRows.length > 50 && (
                  <div className="px-4 py-2 text-xs text-center text-muted-foreground bg-muted/20 border-t">
                    Showing first 50 of <strong>{validRows.length.toLocaleString()}</strong> rows — all rows will be imported
                  </div>
                )}
              </div>

              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/10">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
                  <strong>Clean re-import:</strong> This will <strong>delete all existing stock batches</strong> and re-insert <strong>{validRows.length.toLocaleString()} batches</strong> from
                  your file. Existing medicines will be reused (matched by name). New medicines will be created for unmatched names.
                  <strong>Purchases are not affected.</strong>
                </AlertDescription>
              </Alert>

              <div className="flex items-center justify-between">
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
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border p-5 text-center space-y-1">
              <p className="text-3xl font-bold text-emerald-600">{result.inserted.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Batches Imported</p>
            </div>
            <div className="rounded-xl border p-5 text-center space-y-1">
              <p className="text-3xl font-bold text-blue-600">{result.medicines.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Medicines Created</p>
            </div>
            <div className="rounded-xl border p-5 text-center space-y-1">
              <p className="text-3xl font-bold text-muted-foreground">{result.skipped.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Skipped</p>
            </div>
          </div>

          {result.notFound.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-1.5">
                  {result.notFound.length} medicine(s) could not be created:
                </p>
                <ul className="text-xs space-y-0.5 max-h-24 overflow-y-auto">
                  {result.notFound.map((n, i) => <li key={i} className="font-mono">{n}</li>)}
                </ul>
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
                All records imported successfully! The medicines and stock pages have been refreshed.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={resetState}>
              Import Another File
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
