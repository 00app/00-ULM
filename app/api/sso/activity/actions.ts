/**
 * SSO activity action use case: resolve action type and call activity facade.
 */
import {
  archiveVisibility,
  activateVisibility,
  chronicleHideVisibility,
  deleteActivity,
} from '@/lib/activityFacade'

export type SsoActivityAction = 'archive' | 'activate' | 'chronicle-hide' | 'delete'

export interface SsoActionResult {
  success: boolean
  action: SsoActivityAction
}

export async function executeSsoActivityAction(
  activityId: string,
  action: SsoActivityAction,
  userId: string
): Promise<SsoActionResult> {
  switch (action) {
    case 'archive':
      await archiveVisibility(userId, activityId)
      return { success: true, action: 'archive' }
    case 'activate':
      await activateVisibility(userId, activityId)
      return { success: true, action: 'activate' }
    case 'chronicle-hide':
      await chronicleHideVisibility(userId, activityId)
      return { success: true, action: 'chronicle-hide' }
    case 'delete':
      await deleteActivity(userId, activityId)
      return { success: true, action: 'delete' }
    default:
      throw new Error(`Unknown action: ${action}`)
  }
}
