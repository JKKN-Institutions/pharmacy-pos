import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { ServiceWorkerRegistration } from '@/components/pwa/service-worker-registration'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// Viewport is exported separately per Next.js 14+ convention — keeps
// themeColor out of <meta> and inside the viewport spec where browsers expect it.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',   // handles iPhone notch / safe area insets
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#2563eb' },
    { media: '(prefers-color-scheme: dark)', color: '#1d4ed8' },
  ],
}

export const metadata: Metadata = {
  title: 'Om Sakthi Medicals',
  description: 'Om Sakthi Medicals — Pharmacy Point of Sale & Management System',
  applicationName: 'Om Sakthi Medicals',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Om Sakthi',
  },
  // Apple touch icon shown when user "Add to Home Screen" on iOS (180x180 per Apple spec)
  icons: {
    apple: '/apple-touch-icon.png',
    icon: '/icons/icon-192x192.png',
  },
  formatDetection: {
    // Prevent iOS from auto-linking phone numbers (avoids UI glitches in tables)
    telephone: false,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <ServiceWorkerRegistration />
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
