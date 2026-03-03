'use client'

// This page is served by the service worker as a fallback when any page
// navigation fails (no network + no cached response).
//
// CRITICAL requirements:
//   1. Must be OUTSIDE (dashboard) — the dashboard layout does Supabase auth
//      which requires network. This page must load with zero network calls.
//   2. Must be statically generated (force-static) so @serwist/next includes
//      it in __SW_MANIFEST and precaches it at build time.
//   3. No Supabase imports, no server-side data fetching, no auth.

export const dynamic = 'force-static'

import Link from 'next/link'
import { WifiOff, RefreshCw, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function OfflinePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 text-center">
      {/* Icon */}
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted shadow-sm">
        <WifiOff className="h-10 w-10 text-muted-foreground" />
      </div>

      {/* Message */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">You're offline</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          No internet connection. POS billing still works — your bills sync
          automatically when connectivity returns.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {/* POS works offline via IndexedDB — direct link */}
        <Button asChild>
          <Link href="/pos">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Open POS Billing
          </Link>
        </Button>

        {/* Retry current page */}
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>

      {/* Brand footer */}
      <p className="text-xs text-muted-foreground">Om Sakthi Medicals</p>
    </div>
  )
}
