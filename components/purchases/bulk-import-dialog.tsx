'use client'

import { useState, useRef, useTransition } from 'react'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  AlertTriangle,
  XCircle,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { formatINR } from '@/lib/utils/currency'
import {
  parsePurchasesFile,
  type ParsedPurchaseRow,
} from '@/lib/utils/parse-purchases-csv'
import { bulkImportPurchasesAction } from '@/app/(dashboard)/purchases/actions'

type Step = 'upload' | 'preview' | 'result'

interface ImportResult {
  inserted: number
  skipped: number
  errors: string[]
}

interface BulkImportPurchasesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Derive the auto-generated invoice number — same formula used in the server action */
function toInvoiceNo(row: ParsedPurchaseRow): string {
  const datePart = row.purchase_date.replace(/-/g, '')
  return `IMP-${datePart}-${String(row.raw_row).padStart(3, '0')}`
}

export function BulkImportPurchasesDialog({
  open,
  onOpenChange,
}: BulkImportPurchasesDialogProps) {
  const [step, setStep] = useState<Step>('upload')
  const [rows, setRows] = useState<ParsedPurchaseRow[]>([])
  const [filename, setFilename] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<ImportResult | null>(null)
  const [showInvalidOnly, setShowInvalidOnly] = useState(false)
  // Keep valid rows in state so the result step can display them as a table
  const [importedRows, setImportedRows] = useState<ParsedPurchaseRow[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const validRows = rows.filter((r) => r.isValid)
  const invalidRows = rows.filter((r) => !r.isValid)
  const previewRows = showInvalidOnly ? invalidRows : rows

  function handleClose() {
    onOpenChange(false)
    setTimeout(() => {
      setStep('upload')
      setRows([])
      setFilename('')
      setResult(null)
      setImportedRows([])
      setShowInvalidOnly(false)
    }, 300)
  }

  async function processFile(file: File) {
    const buffer = await file.arrayBuffer()
    try {
      const parsed = parsePurchasesFile(buffer, file.name)
      if (!parsed.length) {
        toast.error('No purchase rows found in the file')
        return
      }
      setFilename(file.name)
      setRows(parsed)
      setShowInvalidOnly(false)
      setStep('preview')
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

  function handleImport() {
    const toImport = validRows
    setImportedRows(toImport)
    startTransition(async () => {
      const res = await bulkImportPurchasesAction(toImport)
      setResult(res)
      setStep('result')
      if (res.errors.length === 0) {
        toast.success(`${res.inserted} purchases imported successfully`)
      } else {
        toast.warning(`Import completed with ${res.errors.length} error(s)`)
      }
    })
  }

  function downloadTemplate() {
    const headers = [
      '#',
      'Supplier Name',
      'Sub Total',
      'Tax',
      'Discount',
      'Amount',
      'Purchase Date',
    ]
    const example = [
      '1',
      'RATHNA PHARMA',
      '₹1887.20',
      '₹94.37',
      '₹0.00',
      '₹1981.57',
      '24/02/2026',
    ]
    const csv = [headers.join(','), example.join(',')].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'purchases_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[90vw] max-h-[90vh] flex flex-col gap-0 p-0">
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogTitle className="text-lg">
              {step === 'upload' && 'Bulk Import Purchases'}
              {step === 'preview' &&
                `Validate & Preview — "${filename}"`}
              {step === 'result' && 'Import Complete'}
            </DialogTitle>
          </DialogHeader>

          {/* ── Step 1: Upload ────────────────────────────────────────────── */}
          {step === 'upload' && (
            <div className="px-6 py-5 space-y-5 overflow-y-auto">
              <p className="text-sm text-muted-foreground">
                Upload an Excel (.xlsx / .xls) or CSV file exported from your
                pharmacy system. Each row is validated before import — invalid
                rows are highlighted and skipped automatically.
              </p>

              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                  <strong>Purchase headers only.</strong> This export has no
                  line-item detail (medicine / batch / qty), so{' '}
                  <strong>stock batches will not be created</strong>. Add
                  individual purchase entries after importing to record stock
                  with batch numbers and expiry dates.
                </AlertDescription>
              </Alert>

              {/* Drop zone */}
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
                <p className="text-sm font-medium mb-1">
                  Drop your Excel or CSV file here
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports .xlsx, .xls, .csv
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
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
                    { label: 'Supplier Name', required: true },
                    { label: 'Sub Total', required: true },
                    { label: 'Tax', required: false },
                    { label: 'Discount', required: false },
                    { label: 'Amount', required: true },
                    { label: 'Purchase Date', required: true },
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
                  * required &nbsp;·&nbsp; Currency values like{' '}
                  <code className="font-mono">₹1,234.56</code> are parsed
                  automatically. Dates must be{' '}
                  <code className="font-mono">DD/MM/YYYY</code>.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={downloadTemplate}
              >
                <Download className="w-4 h-4 mr-2" />
                Download CSV Template
              </Button>
            </div>
          )}

          {/* ── Step 2: Preview + Validation ──────────────────────────────── */}
          {step === 'preview' && (
            <div className="flex flex-col min-h-0 flex-1">
              {/* Summary strip */}
              <div className="px-6 py-3 flex flex-wrap items-center gap-2 flex-shrink-0 border-b bg-muted/30">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {validRows.length.toLocaleString()} valid
                  </span>
                </div>
                {invalidRows.length > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">
                      {invalidRows.length.toLocaleString()} invalid
                    </span>
                  </div>
                )}
                <span className="text-xs text-muted-foreground ml-1">
                  of {rows.length.toLocaleString()} total rows
                </span>

                {/* Filter toggle */}
                {invalidRows.length > 0 && (
                  <button
                    className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border transition-colors
                      ${showInvalidOnly
                        ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-950/40 dark:border-red-700 dark:text-red-400'
                        : 'bg-background border-border text-muted-foreground hover:border-primary/40'
                      }`}
                    onClick={() => setShowInvalidOnly((v) => !v)}
                  >
                    <Filter className="w-3 h-3" />
                    {showInvalidOnly ? 'Show all' : 'Show invalid only'}
                  </button>
                )}
              </div>

              {/* Validation notice */}
              {invalidRows.length > 0 && (
                <div className="px-6 py-2.5 bg-red-50/60 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900 flex-shrink-0">
                  <p className="text-xs text-red-700 dark:text-red-400">
                    <strong>{invalidRows.length} row(s) have errors</strong> and
                    will be skipped. Hover the{' '}
                    <XCircle className="inline w-3 h-3" /> icon to see details.
                    Fix the source file and re-upload, or proceed to import only
                    the {validRows.length} valid rows.
                  </p>
                </div>
              )}

              {/* Scrollable table */}
              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-muted/80 hover:bg-muted/80 backdrop-blur">
                      <TableHead className="text-xs pl-6 w-8">#</TableHead>
                      <TableHead className="text-xs w-20">Status</TableHead>
                      <TableHead className="text-xs">Supplier</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs text-right">Sub Total</TableHead>
                      <TableHead className="text-xs text-right">Tax</TableHead>
                      <TableHead className="text-xs text-right">Discount</TableHead>
                      <TableHead className="text-xs text-right pr-6">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.slice(0, 100).map((row) => (
                      <TableRow
                        key={row.raw_row}
                        className={`border-b border-border/40 ${!row.isValid
                          ? 'bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30'
                          : ''
                          }`}
                      >
                        <TableCell className="text-xs text-muted-foreground pl-6">
                          {row.raw_row}
                        </TableCell>

                        {/* Status cell with tooltip for errors */}
                        <TableCell className="text-xs">
                          {row.isValid ? (
                            <Badge
                              variant="outline"
                              className="text-xs border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Valid
                            </Badge>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className="text-xs border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-950/40 dark:text-red-400 gap-1 cursor-help"
                                >
                                  <XCircle className="w-3 h-3" />
                                  Error
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent
                                side="right"
                                className="max-w-xs text-xs"
                              >
                                <ul className="space-y-0.5 list-disc list-inside">
                                  {row.errors.map((e, i) => (
                                    <li key={i}>{e}</li>
                                  ))}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>

                        <TableCell className="text-xs font-medium max-w-[180px]">
                          <div
                            className={`truncate ${!row.isValid ? 'text-red-700 dark:text-red-400' : ''}`}
                          >
                            {row.supplier_name || (
                              <span className="text-muted-foreground italic">
                                (missing)
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {row.purchase_date ? (
                            format(new Date(row.purchase_date), 'dd MMM yyyy')
                          ) : (
                            <span className="text-red-500 italic">invalid</span>
                          )}
                        </TableCell>

                        <TableCell className="text-xs text-right text-muted-foreground">
                          {row.subtotal > 0 ? formatINR(row.subtotal) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground">
                          {row.tax > 0 ? formatINR(row.tax) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground">
                          {row.discount > 0 ? formatINR(row.discount) : '—'}
                        </TableCell>
                        <TableCell
                          className={`text-xs text-right font-semibold pr-6 ${row.total <= 0 ? 'text-red-500' : ''
                            }`}
                        >
                          {row.total > 0 ? formatINR(row.total) : '₹0.00'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {previewRows.length > 100 && (
                  <div className="px-6 py-3 text-xs text-center text-muted-foreground bg-muted/20 border-t">
                    Showing first 100 of{' '}
                    <strong>{previewRows.length.toLocaleString()}</strong> rows
                    — all valid rows will be imported
                  </div>
                )}
                {previewRows.length === 0 && showInvalidOnly && (
                  <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                    No invalid rows found.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 flex items-center justify-between flex-shrink-0 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep('upload')
                    setRows([])
                    setFilename('')
                    setShowInvalidOnly(false)
                  }}
                >
                  Back
                </Button>
                <div className="flex items-center gap-3">
                  {invalidRows.length > 0 && validRows.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {invalidRows.length} row(s) will be skipped
                    </p>
                  )}
                  <Button
                    onClick={handleImport}
                    disabled={isPending || validRows.length === 0}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {isPending
                      ? 'Importing…'
                      : validRows.length === 0
                        ? 'No valid rows to import'
                        : `Import ${validRows.length.toLocaleString()} purchase${validRows.length === 1 ? '' : 's'}`}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Result ────────────────────────────────────────────── */}
          {step === 'result' && result && (
            <div className="flex flex-col min-h-0 flex-1">
              {/* Stats */}
              <div className="px-6 pt-5 pb-4 flex-shrink-0 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border p-4 text-center space-y-0.5">
                    <p className="text-3xl font-bold text-emerald-600">
                      {result.inserted.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Imported</p>
                  </div>
                  <div className="rounded-xl border p-4 text-center space-y-0.5">
                    <p className="text-3xl font-bold text-muted-foreground">
                      {result.skipped.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                  <div className="rounded-xl border p-4 text-center space-y-0.5">
                    <p className="text-3xl font-bold text-slate-600 dark:text-slate-300">
                      {invalidRows.length.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Skipped (invalid)</p>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <Alert variant="destructive" className="py-3">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-medium mb-1">
                        {result.errors.length} server error(s):
                      </p>
                      <ul className="text-xs space-y-0.5 max-h-24 overflow-y-auto list-disc list-inside">
                        {result.errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {result.errors.length === 0 && result.inserted > 0 && (
                  <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 py-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <AlertDescription className="text-xs text-emerald-700 dark:text-emerald-300">
                      All {result.inserted} purchases imported. The purchases
                      list has been refreshed.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Imported records table */}
              {importedRows.length > 0 && result.inserted > 0 && (
                <>
                  <div className="px-6 pb-2 flex-shrink-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Imported records
                    </p>
                  </div>
                  <div className="flex-1 overflow-auto border-t">
                    <Table>
                      <TableHeader className="sticky top-0 z-10">
                        <TableRow className="bg-muted/80 hover:bg-muted/80 backdrop-blur">
                          <TableHead className="text-xs pl-6">Invoice No.</TableHead>
                          <TableHead className="text-xs">Supplier</TableHead>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs text-right">Sub Total</TableHead>
                          <TableHead className="text-xs text-right">Tax</TableHead>
                          <TableHead className="text-xs text-right">Discount</TableHead>
                          <TableHead className="text-xs text-right pr-6">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importedRows.map((row) => (
                          <TableRow
                            key={row.raw_row}
                            className="border-b border-border/40"
                          >
                            <TableCell className="text-xs font-mono pl-6 text-primary">
                              {toInvoiceNo(row)}
                            </TableCell>
                            <TableCell className="text-xs font-medium max-w-[180px]">
                              <div className="truncate">{row.supplier_name}</div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(row.purchase_date), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell className="text-xs text-right text-muted-foreground">
                              {row.subtotal > 0 ? formatINR(row.subtotal) : '—'}
                            </TableCell>
                            <TableCell className="text-xs text-right text-muted-foreground">
                              {row.tax > 0 ? formatINR(row.tax) : '—'}
                            </TableCell>
                            <TableCell className="text-xs text-right text-muted-foreground">
                              {row.discount > 0 ? formatINR(row.discount) : '—'}
                            </TableCell>
                            <TableCell className="text-xs text-right font-semibold pr-6">
                              {formatINR(row.total)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              {/* Footer */}
              <div className="px-6 py-4 flex justify-end gap-3 flex-shrink-0 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep('upload')
                    setRows([])
                    setFilename('')
                    setResult(null)
                    setImportedRows([])
                    setShowInvalidOnly(false)
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
    </TooltipProvider>
  )
}
