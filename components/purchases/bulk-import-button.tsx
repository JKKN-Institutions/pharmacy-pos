'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import { BulkImportPurchasesDialog } from './bulk-import-dialog'

export function BulkImportPurchasesButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="w-4 h-4 mr-2" />
        Import
      </Button>
      <BulkImportPurchasesDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
