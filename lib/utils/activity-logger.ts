import { createClient } from '@/lib/supabase/server'
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
}

/**
 * Write one activity log entry from a Server Action.
 * Fires-and-forgets — errors are silently swallowed so a logging failure
 * never breaks the primary operation.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const supabase = await createClient()
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
