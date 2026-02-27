'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getBillItemsAction, getPharmacySettingsAction } from '@/app/(dashboard)/pos/bills/actions'
import type { PosBill } from '@/lib/types/database'
import type { BillItem, PharmacyInfo } from './bill-receipt-pdf'

interface Props {
  bill: PosBill
  /** Show "Download PDF" label next to the icon. Default: false (icon only) */
  showLabel?: boolean
  variant?: 'ghost' | 'outline' | 'default' | 'secondary'
}

export function DownloadBillButton({ bill, showLabel = false, variant = 'ghost' }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const [itemsResult, pharmacy] = await Promise.all([
        getBillItemsAction(bill.id),
        getPharmacySettingsAction(),
      ])

      if (itemsResult.error) {
        toast.error('Could not load bill items')
        return
      }

      const items = (itemsResult.data ?? []) as unknown as BillItem[]

      // Dynamic import keeps @react-pdf/renderer out of the SSR bundle
      const [{ pdf }, { BillReceiptDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./bill-receipt-pdf'),
      ])

      const blob = await pdf(
        <BillReceiptDocument
          bill={bill}
          items={items}
          pharmacy={pharmacy as PharmacyInfo}
        />
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${bill.bill_no}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF generation failed:', err)
      toast.error('Failed to generate PDF')
    } finally {
      setLoading(false)
    }
  }

  if (showLabel) {
    return (
      <Button
        variant={variant}
        size="sm"
        onClick={handleDownload}
        disabled={loading}
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Download PDF
      </Button>
    )
  }

  return (
    <Button
      variant={variant}
      size="icon"
      className="h-8 w-8"
      title="Download PDF"
      onClick={handleDownload}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
    </Button>
  )
}
