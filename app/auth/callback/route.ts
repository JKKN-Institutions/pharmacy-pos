import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const oauthError = searchParams.get('error')
  const next = searchParams.get('next') ?? '/dashboard'

  // OAuth provider sent back an error (e.g. user denied permission)
  if (oauthError) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Check the user is a registered pharmacy user
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', user?.id ?? '')
        .maybeSingle()

      if (!profile) {
        // Valid Google account but not registered in this system — sign out
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=unauthorized`)
      }

      const dest = new URL(`${origin}${next}`)
      dest.searchParams.set('login', '1')
      return NextResponse.redirect(dest.toString())
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
