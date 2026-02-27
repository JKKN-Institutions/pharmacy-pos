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

import { type ParsedMedicineRow } from '@/lib/utils/parse-medicines-excel'
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
import type { RowValidation }  from './steps/validate-step'
import type { ImportProgress } from './steps/import-preview-step'
import type { ImportResult }   from './steps/result-step'

// ─── Step type ────────────────────────────────────────────────────────────────

export type Step =
  | 'upload' | 'preview' | 'validate' | 'checking'
  | 'fuzzy' | 'conflicts' | 'import' | 'result'

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

    if      (res.fuzzyMatches.length > 0)   setStep('fuzzy')
    else if (res.exactConflicts.length > 0)  setStep('conflicts')
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

    setConflictResolutions((prev) => {
      const next = { ...prev }
      fuzzyMatches.forEach((fm) => { if (fuzzyDecisions[fm.raw_row] !== 'same') delete next[fm.raw_row] })
      fuzzyConflicts.forEach((c) => {
        if (!next[c.raw_row]) next[c.raw_row] = { action: 'skip', existingId: c.existingId }
      })
      return next
    })

    if (newExactConflicts.length > 0) setStep('conflicts')
    else setStep('import')
  }

  // ── Import ────────────────────────────────────────────────────────────────────

  async function handleImport() {
    setImportProgress({ phase: 'preparing', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 })
    try {
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
    } catch (err) {
      toast.error('Import failed unexpectedly: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setImportProgress((prev) =>
        prev.phase !== 'idle'
          ? { phase: 'idle', currentBatch: 0, totalBatches: 0, insertedSoFar: 0 }
          : prev
      )
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
            isChecking={isChecking}
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
            onBack={() => {
              if (exactConflicts.length > 0) setStep('conflicts')
              else if (fuzzyMatches.length > 0) setStep('fuzzy')
              else setStep('validate')
            }}
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
