/**
 * Activity visibility and delete facade. Persists per-user per-activity status
 * (archive, activate, chronicle-hide, delete) in activity_status.
 */
import { getDbPool } from '@/lib/db'

export async function archiveVisibility(userId: string, activityId: string): Promise<void> {
  await getDbPool().query(
    `INSERT INTO activity_status (user_id, card_id, status, updated_at)
     VALUES ($1::uuid, $2, 'archived', now())
     ON CONFLICT (user_id, card_id) DO UPDATE SET status = 'archived', updated_at = now()`,
    [userId, activityId]
  )
}

export async function activateVisibility(userId: string, activityId: string): Promise<void> {
  await getDbPool().query(
    `INSERT INTO activity_status (user_id, card_id, status, updated_at)
     VALUES ($1::uuid, $2, 'active', now())
     ON CONFLICT (user_id, card_id) DO UPDATE SET status = 'active', updated_at = now()`,
    [userId, activityId]
  )
}

export async function chronicleHideVisibility(userId: string, activityId: string): Promise<void> {
  await getDbPool().query(
    `INSERT INTO activity_status (user_id, card_id, status, updated_at)
     VALUES ($1::uuid, $2, 'chronicle_hidden', now())
     ON CONFLICT (user_id, card_id) DO UPDATE SET status = 'chronicle_hidden', updated_at = now()`,
    [userId, activityId]
  )
}

export async function deleteActivity(userId: string, activityId: string): Promise<void> {
  await getDbPool().query(
    `INSERT INTO activity_status (user_id, card_id, status, updated_at)
     VALUES ($1::uuid, $2, 'deleted', now())
     ON CONFLICT (user_id, card_id) DO UPDATE SET status = 'deleted', updated_at = now()`,
    [userId, activityId]
  )
}
