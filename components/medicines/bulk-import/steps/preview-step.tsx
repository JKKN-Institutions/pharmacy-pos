// components/medicines/bulk-import/steps/preview-step.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ParsedMedicineRow } from '@/lib/utils/parse-medicines-excel'

const PAGE_SIZE = 25

interface PreviewStepProps {
  rows:     ParsedMedicineRow[]
  filename: string
  onBack:   () => void
  onNext:   () => void
}

export function PreviewStep({ rows, filename, onBack, onNext }: PreviewStepProps) {
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const pageRows   = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col min-h-0 flex-1">

      {/* Stats bar */}
      <div className="px-6 py-3 flex items-center gap-3 flex-shrink-0 border-b bg-muted/30">
        <FileSpreadsheet className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm">
          <span className="font-semibold">{rows.length.toLocaleString()} rows</span>
          <span className="text-muted-foreground"> parsed from </span>
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{filename}</span>
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          Review the data below, then click &quot;Run Validation&quot;
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="bg-muted/80 hover:bg-muted/80 backdrop-blur">
              <TableHead className="text-xs pl-6 w-12">Row</TableHead>
              <TableHead className="text-xs min-w-[180px]">Medicine</TableHead>
              <TableHead className="text-xs">Company</TableHead>
              <TableHead className="text-xs">Unit</TableHead>
              <TableHead className="text-xs">Category</TableHead>
              <TableHead className="text-xs text-right">Live Stock</TableHead>
              <TableHead className="text-xs">Tax%</TableHead>
              <TableHead className="text-xs pr-6">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row) => (
              <TableRow key={row.raw_row} className="border-b border-border/40">
                <TableCell className="text-xs text-muted-foreground pl-6 tabular-nums">
                  {row.raw_row}
                </TableCell>
                <TableCell className="text-xs font-medium max-w-[220px]">
                  <div className="truncate">{row.name}</div>
                  {row.generic_name && (
                    <div className="text-muted-foreground truncate mt-0.5">{row.generic_name}</div>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[140px]">
                  <div className="truncate">{row.company ?? '—'}</div>
                </TableCell>
                <TableCell className="text-xs">{row.unit ?? '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[120px]">
                  <div className="truncate">{row.category ?? '—'}</div>
                </TableCell>
                <TableCell className="text-xs tabular-nums text-right">
                  {row.live_stock != null ? row.live_stock.toLocaleString() : '—'}
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {row.tax_percent != null ? `${row.tax_percent}%` : '—'}
                </TableCell>
                <TableCell className="text-xs pr-6 capitalize">{row.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 flex items-center justify-between flex-shrink-0 border-t">
        <Button variant="outline" onClick={onBack}>Back</Button>

        <div className="flex items-center gap-3">
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span>Page {page} / {totalPages}</span>
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <Button onClick={onNext}>
            Run Validation →
          </Button>
        </div>
      </div>
    </div>
  )
}
