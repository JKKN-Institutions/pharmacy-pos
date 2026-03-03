'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function UpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.ready.then((registration) => {
      // Check if there's already a waiting worker on load
      if (registration.waiting) {
        setWaitingWorker(registration.waiting)
      }

      // Listen for future updates — fires when a new SW has been downloaded
      // and is waiting to activate (held back by open tabs)
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          // 'installed' + active controller = a waiting update
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker)
          }
        })
      })
    })

    // When the SW activates after SKIP_WAITING, reload to use the new code
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    })
  }, [])

  function handleUpdate() {
    if (!waitingWorker) return
    setIsUpdating(true)
    // Instruct the waiting SW to skip its waiting phase and activate
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  }

  if (!waitingWorker) return null

  return (
    <Alert className="rounded-xl border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
      <RefreshCw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span className="text-sm">
          A new version of Om Sakthi Medicals is available.
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 shrink-0 border-amber-400 bg-amber-50 px-3 text-xs text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-200"
          onClick={handleUpdate}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <>
              <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />
              Updating…
            </>
          ) : (
            'Update now'
          )}
        </Button>
      </AlertDescription>
    </Alert>
  )
}
