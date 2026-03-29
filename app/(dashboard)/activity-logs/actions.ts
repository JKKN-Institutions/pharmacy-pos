'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface ExportParams {
  search?: string
  action?: string
  entity_type?: string
  from?: string
  to?: string
}

export async function exportActivityLogsAction(
  params: ExportParams,
): Promise<{ csv: string } | { error: string }> {
  const supabase = await createClient()

  // Auth guard — admin only
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (profile?.role !== 'admin') return { error: 'Unauthorized' }

  // Build query — same filters as the page but without pagination
  let query = supabase
    .from('activity_logs')
    .select('created_at, user_name, action, entity_type, entity_label, entity_id, details')
    .order('created_at', { ascending: false })

  if (params.search) query = query.ilike('user_name', `%${params.search}%`)
  if (params.action) query = query.eq('action', params.action)
  if (params.entity_type) query = query.eq('entity_type', params.entity_type)
  if (params.from) query = query.gte('created_at', params.from)
  if (params.to) query = query.lte('created_at', `${params.to}T23:59:59`)

  const { data, error } = await query

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { csv: '' }

  // Build CSV
  const headers = [
    'Date/Time',
    'User',
    'Action',
    'Entity Type',
    'Record',
    'Entity ID',
    'Details',
  ]

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`

  const rows = data.map((row) =>
    [
      new Date(row.created_at).toLocaleString('en-IN'),
      row.user_name,
      row.action,
      row.entity_type,
      row.entity_label ?? '',
      row.entity_id ?? '',
      row.details ? JSON.stringify(row.details) : '',
    ]
      .map(String)
      .map(escape)
      .join(','),
  )

  return { csv: [headers.map(escape).join(','), ...rows].join('\n') }
}
