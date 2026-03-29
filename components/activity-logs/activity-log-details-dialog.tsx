'use client'

import { useState } from 'react'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ActivityLog } from '@/lib/types/database'

export function ActivityLogDetailsDialog({ log }: { log: ActivityLog }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => setOpen(true)}
        title="View details"
      >
        <Eye className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {log.action} &middot; {log.entity_type}
              {log.entity_label ? ` \u00b7 ${log.entity_label}` : ''}
            </DialogTitle>
          </DialogHeader>
          <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
            {JSON.stringify(log.details, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  )
}
