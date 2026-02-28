'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { GitMerge } from 'lucide-react'
import {
  type ExactConflict,
  type ConflictAction,
  type ConflictResolutionsMap,
} from '@/lib/utils/duplicate-detection'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConflictsStepProps {
  exactConflicts:      ExactConflict[]
  conflictResolutions: ConflictResolutionsMap
  onChange:            (rawRow: number, action: ConflictAction, existingId: string) => void
  onBack:              () => void
  onNext:              () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConflictsStep({
  exactConflicts,
  conflictResolutions,
  onChange,
  onBack,
  onNext,
}: ConflictsStepProps) {
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="px-6 py-3 flex-shrink-0 flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground flex-1 min-w-0">
          {exactConflicts.length} medicine{exactConflicts.length === 1 ? '' : 's'} already
          exist in the catalogue. Choose an action for each.
        </span>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => {
            exactConflicts.forEach((c) => {
              onChange(c.raw_row, 'skip', c.existingId)
            })
          }}
        >
          Skip All
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => {
            exactConflicts.forEach((c) => {
              onChange(c.raw_row, 'overwrite', c.existingId)
            })
          }}
        >
          <GitMerge className="w-3.5 h-3.5 mr-1.5" />
          Overwrite All
        </Button>
      </div>

      <div className="flex-1 overflow-auto border-t border-b">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="bg-muted/80 hover:bg-muted/80 backdrop-blur">
              <TableHead className="text-xs pl-6 w-12">Row</TableHead>
              <TableHead className="text-xs">Imported</TableHead>
              <TableHead className="text-xs">Existing in DB</TableHead>
              <TableHead className="text-xs pr-6">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exactConflicts.map((c) => {
              const action: ConflictAction = conflictResolutions[c.raw_row]?.action ?? 'skip'
              return (
                <TableRow
                  key={c.raw_row}
                  className={`border-b border-border/40 transition-colors
                    ${action === 'overwrite' ? 'bg-green-50/40 dark:bg-green-950/20' : ''}
                  `}
                >
                  <TableCell className="text-xs text-muted-foreground pl-6">
                    {c.raw_row}
                  </TableCell>
                  <TableCell className="text-xs max-w-[200px]">
                    <div className="font-medium truncate">{c.importedRow.name}</div>
                    <div className="text-muted-foreground text-[11px] truncate">
                      {[c.importedRow.company, c.importedRow.generic_name, c.importedRow.unit]
                        .filter(Boolean)
                        .join(' / ') || '—'}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs max-w-[200px]">
                    <div className="font-medium truncate">{c.existingName}</div>
                    <div className="text-muted-foreground text-[11px] truncate">
                      {[c.existingCompany, c.existingGenericName, c.existingUnit]
                        .filter(Boolean)
                        .join(' / ') || '—'}
                    </div>
                  </TableCell>
                  <TableCell className="pr-6">
                    <div className="flex gap-1.5">
                      <Button
                        variant={action === 'skip' ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs h-7 px-2.5"
                        onClick={() => onChange(c.raw_row, 'skip', c.existingId)}
                      >
                        Skip
                      </Button>
                      <Button
                        variant={action === 'overwrite' ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs h-7 px-2.5"
                        onClick={() => onChange(c.raw_row, 'overwrite', c.existingId)}
                      >
                        Overwrite
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="px-6 py-4 flex items-center justify-between flex-shrink-0">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>
          Next →
        </Button>
      </div>
    </div>
  )
}
