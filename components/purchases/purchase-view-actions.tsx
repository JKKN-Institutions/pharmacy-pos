'use client'

import { Button } from '@/components/ui/button'
import { Printer, Pencil } from 'lucide-react'
import Link from 'next/link'

export function PurchaseViewActions({ id }: { id: string }) {
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        className="bg-red-600 hover:bg-red-700 text-white"
        onClick={() => window.print()}
      >
        <Printer className="w-4 h-4 mr-1.5" />
        PDF/Print
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href={`/purchases/${id}/edit`}>
          <Pencil className="w-4 h-4 mr-1.5" />
          Edit
        </Link>
      </Button>
    </div>
  )
}
