import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActivityAction, ActivityEntityType } from '@/lib/types/database'

interface LogActivityParams {
  userId: string
  userName: string
  branchId?: string | null
  action: ActivityAction | string
  entityType: ActivityEntityType | string
  entityId?: string | null
  entityLabel?: string | null
  details?: Record<string, unknown>
  /** Pass an existing Supabase client (e.g. from a Route Handler) to reuse its auth session. */
  supabaseClient?: SupabaseClient
}

/**
 * Write one activity log entry.
 * Accepts an optional supabaseClient — pass one from Route Handlers so the
 * insert reuses the already-authenticated client instead of creating a new one
 * (which can lose session context in API routes).
 * Errors are silently swallowed so a logging failure never breaks the primary operation.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const supabase = params.supabaseClient ?? await createClient()
    await supabase.from('activity_logs').insert({
      user_id:      params.userId,
      user_name:    params.userName,
      branch_id:    params.branchId ?? null,
      action:       params.action,
      entity_type:  params.entityType,
      entity_id:    params.entityId   ?? null,
      entity_label: params.entityLabel ?? null,
      details:      params.details    ?? null,
    })
  } catch {
    // Logging must never break the calling action
  }
}
