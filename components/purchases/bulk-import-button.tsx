'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import { BulkImportPurchasesDialog } from './bulk-import-dialog'

export function BulkImportPurchasesButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Upload className="w-4 h-4" />
        Import
      </Button>
      <BulkImportPurchasesDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
