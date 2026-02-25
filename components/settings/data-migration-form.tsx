'use client'

import React, { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, Download, CheckCircle2, AlertCircle, FileText } from 'lucide-react'
import { importMedicinesAction, importCustomersAction, importSuppliersAction } from '@/app/(dashboard)/settings/data-migration/actions'

type ImportResult = { success?: boolean; error?: string; count?: number } | undefined

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((v) => v.trim())
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? '']))
  }).filter((r) => Object.values(r).some((v) => v !== ''))
}

function downloadTemplate(filename: string, headers: string[]) {
  const csv = headers.join(',') + '\n'
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}

interface ImportSectionProps {
  title: string; description: string; templateFilename: string
  templateHeaders: string[]; expectedColumns: string[]
  onImport: (rows: Array<Record<string, string>>) => Promise<ImportResult>
}

function ImportSection({ title, description, templateFilename, templateHeaders, expectedColumns, onImport }: ImportSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult>()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setFileName(file ? file.name : null)
    setResult(undefined)
  }

  function handleImport() {
    const file = fileRef.current?.files?.[0]
    if (!file) { toast.error('Please select a CSV file first'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      if (!rows.length) { toast.error('No valid data found in CSV'); return }
      startTransition(async () => {
        const res = await onImport(rows)
        setResult(res)
        if (res?.error) toast.error(res.error)
        else toast.success(res?.count + ' records imported successfully')
        if (res?.success && fileRef.current) { fileRef.current.value = ''; setFileName(null) }
      })
    }
    reader.readAsText(file)
  }

  const fileId = 'file-' + title.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{description}</p>
      <Button variant="outline" size="sm" onClick={() => downloadTemplate(templateFilename, templateHeaders)}>
        <Download className="w-4 h-4 mr-2" />Download Template
      </Button>
      <div className="rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 transition-colors">
        <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-3">{fileName ? fileName : 'Click to select a CSV file'}</p>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" id={fileId} />
        <label htmlFor={fileId} className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-primary hover:underline">
          <Upload className="w-4 h-4" /> Browse File
        </label>
      </div>
      <div className="text-xs text-muted-foreground">
        <p className="font-medium mb-1">Expected columns:</p>
        <div className="flex flex-wrap gap-1">
          {expectedColumns.map((col) => (<code key={col} className="px-1.5 py-0.5 rounded bg-muted font-mono">{col}</code>))}
        </div>
      </div>
      {result?.error && (<Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{result.error}</AlertDescription></Alert>)}
      {result?.success && (<Alert className="border-green-200 bg-green-50 dark:bg-green-900/10"><CheckCircle2 className="h-4 w-4 text-green-600" /><AlertDescription className="text-green-700 dark:text-green-300">{result.count} records imported!</AlertDescription></Alert>)}
      <Button onClick={handleImport} disabled={isPending || !fileName}>
        <Upload className="w-4 h-4 mr-2" />{isPending ? 'Importing...' : 'Import CSV'}
      </Button>
    </div>
  )
}

export function DataMigrationForm() {
  return (
    <Tabs defaultValue="medicines" className="space-y-4">
      <TabsList>
        <TabsTrigger value="medicines">Medicines</TabsTrigger>
        <TabsTrigger value="customers">Customers</TabsTrigger>
        <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
      </TabsList>

      <TabsContent value="medicines">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader><CardTitle className="text-base font-semibold">Import Medicines</CardTitle><CardDescription>Bulk import medicines from a CSV file into the catalogue</CardDescription></CardHeader>
          <CardContent><ImportSection title="Medicines" description="Upload a CSV file with medicine records. First row must be headers."
            templateFilename="medicines_template.csv"
            templateHeaders={['name', 'company', 'generic_name', 'unit', 'min_level', 'reorder_level']}
            expectedColumns={['name', 'company', 'generic_name', 'unit', 'min_level', 'reorder_level']}
            onImport={importMedicinesAction} /></CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="customers">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader><CardTitle className="text-base font-semibold">Import Customers</CardTitle><CardDescription>Bulk import customer records from a CSV file</CardDescription></CardHeader>
          <CardContent><ImportSection title="Customers" description="Upload a CSV file with customer records. Phone number is required."
            templateFilename="customers_template.csv"
            templateHeaders={['first_name', 'last_name', 'phone', 'email', 'city']}
            expectedColumns={['first_name', 'last_name', 'phone', 'email', 'city']}
            onImport={importCustomersAction} /></CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="suppliers">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader><CardTitle className="text-base font-semibold">Import Suppliers</CardTitle><CardDescription>Bulk import supplier records from a CSV file</CardDescription></CardHeader>
          <CardContent><ImportSection title="Suppliers" description="Upload a CSV file with supplier records. Supplier name is required."
            templateFilename="suppliers_template.csv"
            templateHeaders={['name', 'contact_person', 'phone', 'email', 'city']}
            expectedColumns={['name', 'contact_person', 'phone', 'email', 'city']}
            onImport={importSuppliersAction} /></CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
