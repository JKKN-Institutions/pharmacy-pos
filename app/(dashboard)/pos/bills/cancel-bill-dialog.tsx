'use client'

import { useState } from 'react'
import { Ban, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cancelBillAction } from './actions'
import { toast } from 'sonner'
import type { PosBill } from '@/lib/types/database'

const CANCEL_REASONS = [
  'Wrong medicine dispensed',
  'Customer returned',
  'Billing error',
  'Duplicate bill',
  'Other',
] as const

interface CancelBillDialogProps {
  bill: PosBill
}

export function CancelBillDialog({ bill }: CancelBillDialogProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isCancelled = bill.status === 'cancelled'

  function handleOpen() {
    if (isCancelled) return
    setReason('')
    setNotes('')
    setOpen(true)
  }

  async function handleConfirm() {
    const finalReason = reason === 'Other' && notes.trim()
      ? `Other: ${notes.trim()}`
      : reason + (notes.trim() ? ` — ${notes.trim()}` : '')

    if (!finalReason.trim()) {
      toast.error('Please select a cancellation reason')
      return
    }

    setSubmitting(true)
    const result = await cancelBillAction(bill.id, finalReason)
    setSubmitting(false)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(`Bill ${bill.bill_no} cancelled`)
      setOpen(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive"
        title={isCancelled ? 'Already cancelled' : 'Cancel bill'}
        onClick={handleOpen}
        disabled={isCancelled}
      >
        <Ban className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Bill {bill.bill_no}?</DialogTitle>
            <DialogDescription>
              This will mark the bill as cancelled and restore stock quantities.
              The bill record will be preserved for audit purposes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Reason for cancellation</Label>
              <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
                {CANCEL_REASONS.map((r) => (
                  <div key={r} className="flex items-center gap-2.5">
                    <RadioGroupItem value={r} id={`reason-${r}`} />
                    <Label htmlFor={`reason-${r}`} className="text-sm font-normal cursor-pointer">
                      {r}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cancel-notes" className="text-sm font-medium">
                Additional notes <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="cancel-notes"
                placeholder="Any additional details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Go Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!reason || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Cancelling…
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4 mr-1.5" />
                  Cancel Bill
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
