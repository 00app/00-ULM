'use client'

import { useEffect, useState } from 'react'
import { useApp } from '@/app/context/AppContext'
import { libraryActionForAnyCardId } from '@/lib/actions/actionLibrary'
import { readGuestCompletions } from '@/lib/actions/actionCompletion'

/**
 * Likes still waiting (liked, not marked done) — the number on the nav heart. Null until the
 * server's likes list has loaded, so the badge never shows a guess. Done comes from the server
 * for signed-in users and from this device for guests (same rule as the Likes page).
 */
export function useLikesWaitingCount(): number | null {
  const { state } = useApp()
  const liked = state.likedCards ?? []
  const [serverDone, setServerDone] = useState<Set<string>>(new Set())
  const [guestDone, setGuestDone] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!state.likesLoaded || liked.length === 0) return
    setGuestDone(new Set(readGuestCompletions().map((r) => r.actionId)))
    let cancelled = false
    fetch('/api/actioned', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { actioned_card_ids?: string[] } | null) => {
        if (!cancelled && Array.isArray(d?.actioned_card_ids)) setServerDone(new Set(d.actioned_card_ids))
      })
      .catch(() => {
        /* badge falls back to the plain like count */
      })
    return () => {
      cancelled = true
    }
    // Re-check when the set of likes changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.likesLoaded, liked.join('|')])

  if (!state.likesLoaded) return null
  return liked.filter((id) => {
    if (serverDone.has(id)) return false
    const key = libraryActionForAnyCardId(id)?.id ?? id
    return !guestDone.has(key)
  }).length
}
