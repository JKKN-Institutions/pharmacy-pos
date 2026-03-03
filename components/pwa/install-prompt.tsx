'use client'

import { useState, useEffect } from 'react'
import { Download, Share, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Chrome/Edge fires this event when the app is installable.
// We capture it and defer it so we can trigger the prompt on button click.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Already running as an installed PWA — no banner needed
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true
    setIsStandalone(standalone)

    // iOS Safari: no install event, so we show manual instructions instead
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & typeof globalThis & { MSStream?: unknown }).MSStream
    setIsIOS(ios)

    // Check if the user already dismissed the prompt this session
    const wasDismissed = sessionStorage.getItem('pwa-install-dismissed') === 'true'
    setDismissed(wasDismissed)

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault() // Stop the browser's default mini-infobar
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  function handleDismiss() {
    sessionStorage.setItem('pwa-install-dismissed', 'true')
    setDismissed(true)
    setDeferredPrompt(null)
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  // Don't show if: already a PWA, dismissed this session, or nothing to show
  if (isStandalone || dismissed) return null
  if (!isIOS && !deferredPrompt) return null

  return (
    <Alert className="relative rounded-xl border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-100">
      <Download className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span className="text-sm">
          {isIOS ? (
            <>
              Install Om Sakthi Medicals: tap{' '}
              <Share className="inline h-3.5 w-3.5 text-blue-600" />{' '}
              then <strong>Add to Home Screen</strong>
            </>
          ) : (
            'Install Om Sakthi Medicals on your device for offline counter billing.'
          )}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {!isIOS && (
            <Button
              size="sm"
              variant="default"
              className="h-7 bg-blue-600 px-3 text-xs hover:bg-blue-700"
              onClick={handleInstall}
            >
              Install
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900"
            onClick={handleDismiss}
          >
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
