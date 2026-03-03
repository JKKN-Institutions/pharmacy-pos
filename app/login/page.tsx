'use client'

import { Suspense, useState } from 'react'
import { flushSync } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Pill, Package, BarChart3, ShieldCheck, Wifi, Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

/* ── Google SVG icon ── */
function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

/* ── Feature badges shown on left panel ── */
const features = [
  { icon: Wifi,       label: 'Offline Billing'   },
  { icon: Package,    label: 'Stock Management'  },
  { icon: ShieldCheck,label: 'FEFO Batches'      },
  { icon: BarChart3,  label: 'Sales Analytics'   },
]

/* ── Right-panel form (needs useSearchParams → wrapped in Suspense) ── */
function LoginForm() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const [loading, setLoading] = useState(false)

  async function handleGoogleLogin() {
    // flushSync forces React to paint the loading state to the DOM immediately,
    // before signInWithOAuth fires window.location.assign() and navigates away.
    flushSync(() => setLoading(true))
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    // Reached only if the redirect fails — lets user try again
    setLoading(false)
  }

  return (
    <div className="space-y-5">
      {/* Error banners */}
      {error === 'unauthorized' && (
        <div
          className="animate-fade-up rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-center"
          style={{ animationDelay: '350ms' }}
        >
          This Google account is not registered in this system.
          <br />
          <span className="text-xs opacity-75">Contact your administrator to get access.</span>
        </div>
      )}
      {error === 'auth_failed' && (
        <div
          className="animate-fade-up rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-center"
          style={{ animationDelay: '350ms' }}
        >
          Authentication failed. Please try again.
        </div>
      )}

      {/* Google sign-in button */}
      <div
        className="animate-fade-up"
        style={{ animationDelay: '400ms' }}
      >
        <Button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="btn-shimmer cursor-pointer w-full h-12 gap-3 text-sm font-semibold bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white transition-all duration-200 shadow-md hover:shadow-lg rounded-xl disabled:opacity-80 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin shrink-0" />
              Redirecting to Google…
            </>
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </Button>
      </div>

      {/* Redirecting hint — only visible while loading */}
      {loading && (
        <p className="text-[11px] text-center text-green-500 animate-pulse">
          Opening Google sign-in, please wait…
        </p>
      )}

      {/* Terms */}
      {!loading && (
        <p
          className="animate-fade-up text-[11px] text-center text-gray-400 leading-relaxed"
          style={{ animationDelay: '500ms' }}
        >
          By signing in you agree to our{' '}
          <span className="underline cursor-pointer hover:text-green-600 transition-colors">Terms of Service</span>
          {' '}and{' '}
          <span className="underline cursor-pointer hover:text-green-600 transition-colors">Privacy Policy</span>
        </p>
      )}
    </div>
  )
}

/* ── Page ── */
export default function LoginPage() {
  return (
    <div className="min-h-screen flex overflow-hidden bg-white">

      {/* ════════════════════════════════════════════
          LEFT — Brand panel
      ════════════════════════════════════════════ */}
      <div className="animate-slide-left hidden lg:flex lg:w-[52%] relative flex-col bg-gradient-to-br from-green-500 via-green-600 to-green-800 text-white overflow-hidden">

        {/* Dot-grid texture overlay */}
        <div className="dots-pattern absolute inset-0 pointer-events-none" />

        {/* Drifting blur orbs */}
        <div className="animate-orb-drift   absolute -top-32 -right-24  w-96 h-96 rounded-full bg-green-400/25 blur-3xl pointer-events-none" />
        <div className="animate-orb-drift-2 absolute -bottom-24 -left-20 w-80 h-80 rounded-full bg-green-900/35 blur-3xl pointer-events-none" />
        <div className="animate-orb-drift   absolute top-1/2  right-8   w-48 h-48 rounded-full bg-white/10  blur-2xl pointer-events-none" style={{ animationDelay: '4s' }} />

        {/* ── Logo (top-left) ── */}
        <div
          className="animate-fade-up relative z-10 flex items-center gap-3 px-10 pt-10"
          style={{ animationDelay: '150ms' }}
        >
          <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-md">
            <Pill className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Om Sakthi Medicals</span>
        </div>

        {/* ── Center hero ── */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-12 text-center">

          {/* Pulsing ring + floating icon */}
          <div
            className="animate-fade-up relative mb-8"
            style={{ animationDelay: '250ms' }}
          >
            {/* outer pulse ring */}
            <div className="animate-pulse-ring absolute inset-0 rounded-3xl bg-white/20 scale-110" />
            {/* second delayed ring */}
            <div className="animate-pulse-ring absolute inset-0 rounded-3xl bg-white/10 scale-125" style={{ animationDelay: '1.2s' }} />
            {/* icon box */}
            <div className="animate-icon-float relative w-28 h-28 rounded-3xl bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center shadow-xl">
              <Pill className="w-14 h-14 text-white drop-shadow-lg" />
            </div>
          </div>

          {/* Title */}
          <h1
            className="animate-fade-up text-3xl font-bold tracking-tight mb-3"
            style={{ animationDelay: '320ms' }}
          >
            Smart Pharmacy System
          </h1>

          {/* Tagline */}
          <p
            className="animate-fade-up text-green-100/90 text-sm leading-relaxed max-w-xs"
            style={{ animationDelay: '390ms' }}
          >
            Manage medicines, billing, and stock — all in one place, even without internet.
          </p>

          {/* Feature badges — staggered pop-in */}
          <div className="grid grid-cols-2 gap-3 mt-10 w-full max-w-sm">
            {features.map(({ icon: Icon, label }, i) => (
              <div
                key={label}
                className="animate-badge-pop flex items-center gap-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/15 rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-200 cursor-default"
                style={{ animationDelay: `${460 + i * 80}ms` }}
              >
                <Icon className="w-4 h-4 text-green-200 shrink-0" />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <p
          className="animate-fade-up relative z-10 text-center text-[11px] text-green-200/70 px-10 pb-8"
          style={{ animationDelay: '750ms' }}
        >
          © 2026 Om Sakthi Medicals. All rights reserved.
        </p>
      </div>

      {/* ════════════════════════════════════════════
          RIGHT — Sign-in panel
      ════════════════════════════════════════════ */}
      <div className="animate-slide-right flex-1 flex flex-col items-center justify-center bg-white px-8 py-12 relative">

        {/* Subtle background tint */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-50/40 via-white to-white pointer-events-none" />

        <div className="relative z-10 w-full max-w-sm">

          {/* Mobile-only brand mark */}
          <div
            className="animate-fade-up lg:hidden flex items-center gap-2 mb-10"
            style={{ animationDelay: '100ms' }}
          >
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center shadow-md">
              <Pill className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-800">Om Sakthi Medicals</span>
          </div>

          {/* Heading */}
          <h2
            className="animate-fade-up text-2xl font-bold text-gray-900 mb-1"
            style={{ animationDelay: '200ms' }}
          >
            Welcome Back
          </h2>

          {/* Subtitle */}
          <p
            className="animate-fade-up text-sm text-gray-500 mb-8"
            style={{ animationDelay: '280ms' }}
          >
            Sign in to access your pharmacy dashboard
          </p>

          {/* Form content */}
          <Suspense
            fallback={
              <div className="h-12 w-full rounded-xl bg-gray-100 animate-pulse" />
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </div>

    </div>
  )
}
