/**
 * Recursive Rebirth — zip-shut → brain pulse → zip-open (0.12s mechanical snap).
 * Aligns Solo Focus overlays with `SOLO_FOCUS_ZIP_SHUT_SEC` in `lib/animations.ts`.
 */

import { SOLO_FOCUS_ZIP_SHUT_SEC } from '@/lib/animations'

/** Zip-open delay after shut + Neon/Gemini rebirth payload is applied (ms). */
export const SOLO_FOCUS_REBIRTH_OPEN_MS = Math.round(SOLO_FOCUS_ZIP_SHUT_SEC * 1000)

export type RebirthDiscoveryPayload = {
  new_discovery_card?: { id?: string } | null
  discovery?: { new_card_data?: { id?: string } | null } | null
}

/** Resolve the birthed Zone / discovery card id from POST /api/answers JSON. */
export function resolveBirthedCardId(payload: RebirthDiscoveryPayload): string | null {
  const fromNdc =
    typeof payload.new_discovery_card?.id === 'string' ? payload.new_discovery_card.id.trim() : ''
  if (fromNdc) return fromNdc
  const raw = payload.discovery?.new_card_data
  if (raw && typeof raw === 'object' && 'id' in raw) {
    const id = (raw as { id?: unknown }).id
    if (typeof id === 'string' && id.trim()) return id.trim()
  }
  return null
}

export function scheduleSoloFocusRebirthOpen(onOpen: () => void, delayMs = SOLO_FOCUS_REBIRTH_OPEN_MS): void {
  if (typeof window === 'undefined') {
    onOpen()
    return
  }
  window.setTimeout(onOpen, delayMs)
}

/**
 * Industrial handshake: collapse UI → apply rebirth content → expand after 120ms.
 */
export function runRecursiveRebirthHandshake(opts: {
  zipShut: () => void
  applyRebirth: () => void | Promise<void>
  zipOpen: () => void
  openDelayMs?: number
}): void {
  opts.zipShut()
  void Promise.resolve(opts.applyRebirth()).then(() => {
    scheduleSoloFocusRebirthOpen(opts.zipOpen, opts.openDelayMs)
  })
}
