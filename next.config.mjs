import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  // Points to our service worker source (TypeScript)
  swSrc: 'app/sw.ts',
  // Output destination (must be in public/ so browsers can fetch it)
  swDest: 'public/sw.js',
  // Reload all open tabs automatically when connectivity returns
  reloadOnOnline: true,
  // Disable service worker in dev — avoids caching stale code during development
  disable: process.env.NODE_ENV === 'development',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: `bun run build` uses `next build --webpack` (see package.json) so that
  // @serwist/next's webpack plugin can bundle the service worker at build time.
  // Dev still uses Turbopack for fast HMR; Serwist is disabled in dev anyway.
  // Empty turbopack config silences the "webpack config detected" error in dev.
  turbopack: {},
  experimental: {
    serverActions: {
      // Increased for bulk import — stock batch imports can exceed the default 1 MB limit
      // (e.g. 9,000+ rows sent to prepareStockBatchImportAction at once).
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      {
        // Service worker must never be cached by the browser itself
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Prevents Referer header from leaking pharmacy patient/medicine data to external sites
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Pharmacy app: explicitly deny camera/mic access; allow geolocation for future delivery features
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=*, payment=()' },
        ],
      },
    ]
  },
}

export default withSerwist(nextConfig)
