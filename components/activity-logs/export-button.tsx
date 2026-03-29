'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { exportActivityLogsAction } from '@/app/(dashboard)/activity-logs/actions'

export function ExportButton() {
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()

  async function handleExport() {
    setLoading(true)
    try {
      const result = await exportActivityLogsAction({
        search: searchParams.get('search') ?? undefined,
        action: searchParams.get('action') ?? undefined,
        entity_type: searchParams.get('entity_type') ?? undefined,
        from: searchParams.get('from') ?? undefined,
        to: searchParams.get('to') ?? undefined,
      })

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      if (!result.csv) {
        toast.info('No records to export')
        return
      }

      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      {loading ? (
        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
      ) : (
        <Download className="w-4 h-4 mr-1.5" />
      )}
      Export CSV
    </Button>
  )
}
