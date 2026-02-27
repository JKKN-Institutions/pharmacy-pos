// components/medicines/bulk-import/steps/upload-step.tsx
'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, FileSpreadsheet } from 'lucide-react'
import { VALID_UNITS, VALID_GST_SLABS } from '@/lib/validators/medicine-schema'
import { generateMedicinesTemplate } from '@/lib/utils/generate-medicines-template'
import type { ParsedMedicineRow } from '@/lib/utils/parse-medicines-excel'
import { parseMedicinesFile } from '@/lib/utils/parse-medicines-excel'
import { toast } from 'sonner'

interface UploadStepProps {
  onFileLoaded: (rows: ParsedMedicineRow[], filename: string) => void
}

export function UploadStep({ onFileLoaded }: UploadStepProps) {
  const fileRef  = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [parsing,  setParsing ] = useState(false)

  async function processFile(file: File) {
    setParsing(true)
    try {
      const buffer = await file.arrayBuffer()
      const parsed = parseMedicinesFile(buffer, file.name)
      if (!parsed.length) {
        toast.error('No valid medicine rows found in the file')
        return
      }
      onFileLoaded(parsed, file.name)
    } catch (e) {
      toast.error('Failed to parse file: ' + (e as Error).message)
    } finally {
      setParsing(false)
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

  return (
    <div className="px-6 py-5 space-y-5 overflow-y-auto">
      <p className="text-sm text-muted-foreground">
        Upload an Excel (.xlsx / .xls) file. The system will let you preview the data,
        validate each row, check for conflicts, then import with a progress bar.
      </p>

      {/* Drop zone */}
      <div
        className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer select-none
          ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/30'}
          ${parsing   ? 'opacity-60 pointer-events-none' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium mb-1">
          {parsing ? 'Parsing file…' : 'Drop your Excel file here or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground">Supports .xlsx, .xls</p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
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
            { label: 'Medicine',     required: true  },
            { label: 'Company',      required: false },
            { label: 'Unit',         required: false },
            { label: 'Unit/Packing', required: false },
            { label: 'Category',     required: false },
            { label: 'Storebox',     required: false },
            { label: 'Reorderlevel', required: false },
            { label: 'Status',       required: false },
            { label: 'Generic Name', required: false },
            { label: 'Tax%',         required: false },
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
          * required &nbsp;·&nbsp; Unit: {VALID_UNITS.join(', ')} &nbsp;·&nbsp;
          Tax%: {VALID_GST_SLABS.join(', ')}
        </p>
      </div>

      {/* Template download */}
      <Button variant="outline" size="sm" className="w-full" onClick={generateMedicinesTemplate}>
        <Download className="w-4 h-4 mr-2" />
        Download Excel Template (.xlsx)
      </Button>
    </div>
  )
}
