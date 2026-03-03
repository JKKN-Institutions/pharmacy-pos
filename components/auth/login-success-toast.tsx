'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface LoginSuccessToastProps {
  name: string
}

/**
 * Fires a personalized welcome toast when the user lands from a Google OAuth
 * redirect. The callback route stamps ?login=1 on the destination URL;
 * this component reads it via Next.js useSearchParams (router-state-safe),
 * fires the toast, then replaces the URL to avoid re-firing on reload.
 *
 * Must be wrapped in <Suspense> at the call site because useSearchParams()
 * opts the component into dynamic rendering.
 */
export function LoginSuccessToast({ name }: LoginSuccessToastProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const isLoginRedirect = searchParams.get('login') === '1'

  useEffect(() => {
    if (!isLoginRedirect) return

    const firstName = name.split(' ')[0]
    toast.success(`Welcome back, ${firstName}!`, {
      description: 'You are signed in to Om Sakthi Medicals.',
      duration: 4000,
    })

    // Clean ?login=1 from the address bar — prevents re-fire on page refresh
    router.replace(window.location.pathname, { scroll: false })
  }, [isLoginRedirect, name, router])

  return null
}
