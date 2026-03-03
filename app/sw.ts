/// <reference lib="WebWorker" />
// ^ Gives TypeScript access to ServiceWorkerGlobalScope, ExtendableMessageEvent, etc.
// This file runs in the SW context (not the browser window), so we need WebWorker types.

import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import {
  Serwist,
  CacheFirst,
  NetworkFirst,
  NetworkOnly,
  StaleWhileRevalidate,
  ExpirationPlugin,
  CacheableResponsePlugin,
} from 'serwist'

// Serwist v9 uses a class-based API. The __SW_MANIFEST is injected by the
// @serwist/next webpack plugin at build time — it lists all static assets
// (JS chunks, CSS, fonts) to precache so the app shell works offline.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[]
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,

  // Skip waiting: activate new service worker immediately instead of waiting
  // for all tabs to close. Combined with clientsClaim, this means users get
  // the latest version without having to close/reopen the app.
  skipWaiting: true,
  clientsClaim: true,

  // NavigationPreload: starts the server request for a navigation while the
  // service worker is still booting — reduces perceived latency for SSR pages.
  navigationPreload: true,

  runtimeCaching: [
    // ── Supabase REST API ──────────────────────────────────────────────────
    // NetworkFirst: always try network, fall back to cache if offline.
    // Medicine catalog, purchase queries, etc.
    {
      matcher: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
      handler: new NetworkFirst({
        cacheName: 'supabase-api',
        networkTimeoutSeconds: 10,
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 5 }),
        ],
      }),
    },

    // ── Supabase Auth endpoints ────────────────────────────────────────────
    // NetworkOnly: auth tokens must always come from the server.
    {
      matcher: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
      handler: new NetworkOnly(),
    },

    // ── Supabase Storage (medicine images, invoice PDFs) ──────────────────
    // CacheFirst with long TTL — uploaded assets don't change.
    {
      matcher: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
      handler: new CacheFirst({
        cacheName: 'supabase-storage',
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }),
        ],
      }),
    },

    // ── Internal POS sync API ──────────────────────────────────────────────
    // NetworkFirst — medicine catalog must be fresh when online,
    // but cached response keeps offline fallback working.
    {
      matcher: /\/api\/pos\/.*/,
      handler: new NetworkFirst({
        cacheName: 'pos-api',
        networkTimeoutSeconds: 8,
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 10 }),
        ],
      }),
    },

    // ── Google Fonts stylesheets ───────────────────────────────────────────
    {
      matcher: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: new StaleWhileRevalidate({
        cacheName: 'google-fonts-stylesheets',
        plugins: [
          new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 7 }),
        ],
      }),
    },

    // ── Google Fonts files ─────────────────────────────────────────────────
    {
      matcher: /^https:\/\/fonts\.gstatic\.com\/.*/i,
      handler: new CacheFirst({
        cacheName: 'google-fonts-webfonts',
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
        ],
      }),
    },

    // ── Fallback: all other same-origin requests (images, static files) ───
    ...defaultCache,
  ],
})

serwist.addEventListeners()

// ── SKIP_WAITING message ──────────────────────────────────────────────────
// The UpdatePrompt component posts this message when the user clicks "Update".
// Without this handler, the new SW would wait for all tabs to close before
// activating — unacceptable for a pharmacy counter that runs all day.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
