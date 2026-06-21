/** Unread wall / Solo Focus cells — show + on category label and nav destinations. */

import { isCardVisited } from '@/lib/zone/visitedCards'

export function isSoloFocusUnreadCard(cardId: string | null | undefined): boolean {
  const id = cardId?.trim()
  if (!id) return false
  return !isCardVisited(id)
}
