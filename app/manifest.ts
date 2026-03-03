import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Om Sakthi Medicals',
    short_name: 'Om Sakthi',
    description: 'Om Sakthi Medicals — Pharmacy Point of Sale & Management System',
    start_url: '/pos',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#2563eb',       // blue-600 — matches app sidebar/brand color
    background_color: '#ffffff',
    categories: ['medical', 'productivity', 'business'],
    lang: 'en',
    dir: 'ltr',
    prefer_related_applications: false,
    icons: [
      {
        src: '/icons/icon-72x72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-128x128.png',
        sizes: '128x128',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-144x144.png',
        sizes: '144x144',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-152x152.png',
        sizes: '152x152',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-384x384.png',
        sizes: '384x384',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    // Screenshots shown in the browser's install prompt (Chrome 111+, Edge 111+)
    // Capture real screenshots and place in public/screenshots/ to activate this.
    // screenshots: [
    //   { src: '/screenshots/desktop.png', sizes: '1920x1080', type: 'image/png', form_factor: 'wide' },
    //   { src: '/screenshots/mobile.png',  sizes: '390x844',   type: 'image/png', form_factor: 'narrow' },
    // ],
    shortcuts: [
      {
        name: 'New Bill',
        short_name: 'POS',
        description: 'Open POS billing counter',
        url: '/pos',
        icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }],
      },
      {
        name: 'Medicines',
        short_name: 'Medicines',
        description: 'View medicine inventory',
        url: '/medicines',
        icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }],
      },
    ],
  }
}
