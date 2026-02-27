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
import type { ParsedMedicineRow } from '@/lib/utils/parse-medicines-excel'

export interface RowValidation {
  row: ParsedMedicineRow
  status: 'valid' | 'duplicate' | 'error'
  reason?: string
}

type FilterTab = 'all' | 'valid' | 'errors' | 'duplicates'

interface ValidateStepProps {
  allRows:           RowValidation[]
  filename:          string
  isChecking?:       boolean
  onBack:            () => void
  onCheckDuplicates: () => void
}

export function ValidateStep({
  allRows, filename, isChecking, onBack, onCheckDuplicates,
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
    { key: 'all',        label: 'All',        count: allRows.length       },
    { key: 'valid',      label: 'Valid',       count: validRows.length     },
    { key: 'errors',     label: 'Errors',      count: errorRows.length     },
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
                  ${rv.status === 'error'     ? 'bg-red-50/30 dark:bg-red-950/10'     : ''}
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
        <Button disabled={validRows.length === 0 || !!isChecking} onClick={onCheckDuplicates}>
          <ScanSearch className="w-4 h-4 mr-2" />
          Check for Conflicts →
        </Button>
      </div>
    </div>
  )
}
