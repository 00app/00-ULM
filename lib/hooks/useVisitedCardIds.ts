'use client'

import { useCallback, useEffect, useState } from 'react'
import { readVisitedCardIds } from '@/lib/zone/visitedCards'

export function useVisitedCardIds() {
  const [visitedIds, setVisitedIds] = useState<Set<string>>(() => readVisitedCardIds())

  useEffect(() => {
    const sync = () => setVisitedIds(readVisitedCardIds())
    sync()
    window.addEventListener('zz-visited-cards-changed', sync)
    return () => window.removeEventListener('zz-visited-cards-changed', sync)
  }, [])

  const isUnreadCard = useCallback(
    (cardId: string | null | undefined) => {
      const id = cardId?.trim()
      if (!id) return false
      return !visitedIds.has(id)
    },
    [visitedIds]
  )

  return { visitedIds, isUnreadCard }
}
