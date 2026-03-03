import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tax_rates')
    .select('id, name, rate')
    .eq('is_active', true)
    .order('rate', { ascending: true })

  if (error) return NextResponse.json({ taxRates: [] })
  return NextResponse.json({ taxRates: data ?? [] })
}
