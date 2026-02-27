'use client'

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
import { ScanSearch } from 'lucide-react'
import { type FuzzyMatch } from '@/lib/utils/duplicate-detection'

// ─── Props ────────────────────────────────────────────────────────────────────

interface FuzzyStepProps {
  fuzzyMatches:   FuzzyMatch[]
  fuzzyDecisions: Record<number, 'different' | 'same'>
  onChange:       (rawRow: number, decision: 'different' | 'same') => void
  onBack:         () => void
  onNext:         () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FuzzyStep({
  fuzzyMatches,
  fuzzyDecisions,
  onChange,
  onBack,
  onNext,
}: FuzzyStepProps) {
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="px-6 py-3 flex-shrink-0 space-y-3">
        <Alert className="py-2.5">
          <ScanSearch className="h-4 w-4" />
          <AlertDescription className="text-xs leading-relaxed">
            These medicines have <strong>similar (but not identical)</strong> names to existing
            records (within {3} character edits). Decide if they are the same product or genuinely
            different — "Same" treats them as a conflict you can skip or overwrite.
          </AlertDescription>
        </Alert>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
              fuzzyMatches.forEach((fm) => { onChange(fm.raw_row, 'different') })
            }}
          >
            All Different
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
              fuzzyMatches.forEach((fm) => { onChange(fm.raw_row, 'same') })
            }}
          >
            All Same →
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {Object.keys(fuzzyDecisions).length} of {fuzzyMatches.length} decided
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto border-t border-b">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="bg-muted/80 hover:bg-muted/80 backdrop-blur">
              <TableHead className="text-xs pl-6 w-12">Row</TableHead>
              <TableHead className="text-xs">Imported Name</TableHead>
              <TableHead className="text-xs">Existing in DB</TableHead>
              <TableHead className="text-xs w-14 text-center">Edits</TableHead>
              <TableHead className="text-xs pr-6">Decision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fuzzyMatches.map((fm) => {
              const decision = fuzzyDecisions[fm.raw_row]
              return (
                <TableRow
                  key={fm.raw_row}
                  className={`border-b border-border/40 transition-colors
                    ${decision === 'same' ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}
                    ${decision === 'different' ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''}
                  `}
                >
                  <TableCell className="text-xs text-muted-foreground pl-6">
                    {fm.raw_row}
                  </TableCell>
                  <TableCell className="text-xs font-medium max-w-[200px]">
                    <div className="truncate">{fm.importedName}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                    <div className="truncate">{fm.existingName}</div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-xs font-mono">
                      ±{fm.distance}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-6">
                    <div className="flex gap-1.5">
                      <Button
                        variant={decision === 'different' ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs h-7 px-2.5"
                        onClick={() => onChange(fm.raw_row, 'different')}
                      >
                        Different
                      </Button>
                      <Button
                        variant={decision === 'same' ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs h-7 px-2.5"
                        onClick={() => onChange(fm.raw_row, 'same')}
                      >
                        Same →
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
        <Button
          variant="outline"
          onClick={onBack}
        >
          Back
        </Button>
        <Button
          disabled={fuzzyMatches.some((fm) => !fuzzyDecisions[fm.raw_row])}
          onClick={onNext}
        >
          Next →
        </Button>
      </div>
    </div>
  )
}
