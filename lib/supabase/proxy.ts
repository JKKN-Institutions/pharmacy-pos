import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Guard: if Supabase env vars are missing, redirect to login rather than crashing
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  const { pathname } = request.nextUrl

  // Skip Supabase session refresh for public routes — prevents network errors
  // (e.g. "Connection closed") from surfacing on the login page itself.
  // PWA assets (manifest, SW, offline page) must also be public so browsers can
  // fetch them without auth — otherwise Chrome gets HTML instead of JSON for the
  // manifest and shows "Manifest: Syntax error".
  const publicRoutes = ['/login', '/auth/callback', '/manifest.webmanifest', '/sw.js', '/offline']
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do not remove this call.
  // Wrapped in try-catch because @supabase/ssr throws (rather than returning { error })
  // when the stored refresh token is invalid or has been invalidated server-side
  // (e.g. session revoked, JWT secret rotated, user signed in elsewhere).
  let user = null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (!error) user = data.user
  } catch {
    // Stale / invalid session — fall through to the !user redirect below
  }

  // Redirect unauthenticated users to login and clear stale Supabase cookies
  // so the browser doesn't get stuck in a refresh-token error loop on the next visit.
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirectResponse = NextResponse.redirect(url)
    request.cookies.getAll()
      .filter(c => c.name.startsWith('sb-'))
      .forEach(c => redirectResponse.cookies.delete(c.name))
    return redirectResponse
  }

  return supabaseResponse
}
