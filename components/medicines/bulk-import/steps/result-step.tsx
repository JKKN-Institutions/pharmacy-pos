'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertCircle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportResult {
  inserted: number
  overwritten: number
  skipped: number
  errors: string[]
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ResultStepProps {
  result: ImportResult
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ResultStep({ result, onClose }: ResultStepProps) {
  return (
    <div className="px-6 py-6 space-y-5 overflow-y-auto">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border p-5 text-center space-y-1">
          <p className="text-4xl font-bold text-emerald-600">
            {result.inserted.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">Medicines Added</p>
        </div>
        <div className="rounded-xl border p-5 text-center space-y-1">
          <p className="text-4xl font-bold text-blue-600">
            {result.overwritten.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">Medicines Updated</p>
        </div>
        <div className="rounded-xl border p-5 text-center space-y-1">
          <p className="text-4xl font-bold text-muted-foreground">
            {result.skipped.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">Skipped</p>
        </div>
      </div>

      {result.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-1.5">{result.errors.length} batch error(s) occurred:</p>
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
            Import complete. The medicines page has been refreshed.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={onClose}
        >
          Import Another File
        </Button>
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  )
}
