import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - manifest.webmanifest (PWA manifest — must be public for install prompt)
     * - sw.js (service worker — must be fetchable without auth)
     * - offline (offline fallback page — must load without network/auth)
     * - public folder assets (images, icons, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|sw\\.js|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
