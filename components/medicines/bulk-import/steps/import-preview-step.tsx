'use client'

import {
  CheckCircle2,
  AlertCircle,
  Info,
  Loader2,
  Upload,
  GitMerge,
} from 'lucide-react'
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
import type { ParsedMedicineRow } from '@/lib/utils/parse-medicines-excel'
import type {
  ExactConflict,
  ConflictResolutionsMap,
} from '@/lib/utils/duplicate-detection'

// ─── Types (exported so orchestrator can import from here) ────────────────────

export type ImportPhase = 'idle' | 'preparing' | 'inserting'

export interface ImportProgress {
  phase: ImportPhase
  currentBatch: number
  totalBatches: number
  insertedSoFar: number
}

// ─── Props ────────────────────────────────────────────────────────────────────

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

// ─── Progress bar (local only) ────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportPreviewStep({
  validRows,
  exactConflicts,
  conflictResolutions,
  skippedCount,
  isImporting,
  importProgress,
  onBack,
  onImport,
}: ImportPreviewStepProps) {
  const hasLiveStock = validRows.some((r) => r.live_stock !== null)

  const progressPct =
    importProgress.phase === 'inserting' && importProgress.totalBatches > 0
      ? Math.round((importProgress.currentBatch / importProgress.totalBatches) * 100)
      : 0

  return (
    <div className="flex flex-col min-h-0 flex-1">

      {/* ── Importing overlay ── */}
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
              {importProgress.phase === 'preparing' ? 'Preparing import…' : 'Importing medicines…'}
            </p>
            <p className="text-sm text-muted-foreground">
              {importProgress.phase === 'preparing'
                ? 'Setting up categories and building payloads'
                : `${importProgress.insertedSoFar.toLocaleString()} medicines processed · batch ${importProgress.currentBatch} of ${importProgress.totalBatches}`}
            </p>
          </div>

          <div className="w-full max-w-xs space-y-2">
            <ProgressBar
              value={progressPct}
              indeterminate={importProgress.phase === 'preparing'}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {importProgress.phase === 'preparing' ? 'Please wait…' : `${progressPct}% complete`}
              </span>
              {importProgress.phase === 'inserting' && (
                <span>{importProgress.currentBatch} / {importProgress.totalBatches} batches</span>
              )}
            </div>
          </div>

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
        /* ── Normal preview table ── */
        <>
          <div className="px-6 py-4 space-y-3 flex-shrink-0">
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  {validRows.filter((r) => !conflictResolutions[r.raw_row] || conflictResolutions[r.raw_row].action !== 'skip').length.toLocaleString()} rows to import
                </span>
              </div>
              {Object.values(conflictResolutions).filter((r) => r.action === 'overwrite').length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                  <GitMerge className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-700 dark:text-blue-400">
                    {Object.values(conflictResolutions).filter((r) => r.action === 'overwrite').length} to overwrite
                  </span>
                </div>
              )}
              {Object.values(conflictResolutions).filter((r) => r.action === 'skip').length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-amber-700 dark:text-amber-400">
                    {Object.values(conflictResolutions).filter((r) => r.action === 'skip').length} conflicts skipped
                  </span>
                </div>
              )}
              {skippedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                  <span className="font-bold">{skippedCount.toLocaleString()}</span> validation skipped
                </span>
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
                <strong>{validRows.length.toLocaleString()}</strong> rows — all rows will be imported
              </div>
            )}
          </div>

          <div className="px-6 py-4 flex items-center justify-between flex-shrink-0">
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button onClick={onImport}>
              <Upload className="w-4 h-4 mr-2" />
              Import {validRows.length.toLocaleString()} medicines
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
