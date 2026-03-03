'use client'

import { useEffect } from 'react'

// Explicitly registers public/sw.js on every page load (production only).
//
// Why this is needed:
//   @serwist/next sets `disable: true` in dev mode, which means it never
//   injects the SW registration script — even in production that injection
//   is only added when the webpack plugin runs. Having this component ensures
//   the SW is registered unconditionally, which is the prerequisite for
//   Chrome to fire `beforeinstallprompt` and show the install icon.
//
// Why NOT in development:
//   public/sw.js is a production build artifact. Its __SW_MANIFEST contains
//   webpack asset hashes from the last `bun run build`. Turbopack (used by
//   `bun run dev`) generates completely different hashes, so every precache
//   entry returns 404 → bad-precaching-response errors in the console.
//   The stale SW also intercepts /manifest.webmanifest via defaultCache and
//   can return a broken cached response → "Manifest: Syntax error" in Chrome.
//   We match @serwist/next's own policy: disable in development.
//
// Registering twice (if Serwist also injects in production) is harmless —
// browsers deduplicate registrations for the same SW URL and scope.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // In development (Turbopack), public/sw.js is a stale production artifact.
    // Its __SW_MANIFEST contains webpack hashes that don't exist under Turbopack,
    // causing bad-precaching-response 404s AND a cached broken /manifest.webmanifest
    // response (→ "Manifest: Syntax error" in DevTools).
    //
    // Solution: actively unregister ALL service workers + wipe their caches every
    // time the dev server loads. This self-heals any browser left with a stale SW
    // from a previous production build, without requiring manual DevTools cleanup.
    if (process.env.NODE_ENV === 'development') {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => reg.unregister())
      })
      // Also clear all SW-owned caches so stale manifest/asset responses are gone.
      caches.keys().then((keys) => {
        keys.forEach((key) => caches.delete(key))
      })
      return
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // Kick off an immediate update check so a waiting SW (new version)
        // is detected on first page load rather than only on subsequent ones.
        reg.update().catch(() => {/* network may be offline — safe to ignore */})
      })
      .catch((err) => {
        // SW registration failures must never crash the app.
        // Common in dev (Turbopack / localhost HTTP quirks) — log only.
        console.warn('[SW] Registration failed:', err)
      })
  }, [])

  return null
}
