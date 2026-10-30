import { supabase } from './supabase'

/** Journalise une action administrative dans audit_logs. */
export async function logAudit(
  userId: string | undefined,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, unknown>
) {
  if (!userId) return
  await supabase.from('enquete_satisfaction_audit_logs').insert({
    user_id: userId,
    action,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    details: details ?? null,
  })
}
