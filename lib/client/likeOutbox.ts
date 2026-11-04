/**
 * Like/unlike outbox: the state this device asked for, kept until the server has answered.
 *
 * /api/likes POST is a toggle, and it waits on a session check before it is sent, so a tap
 * followed by leaving the page (reload, tab close, full navigation) could die before the request
 * went out. The device still showed the like (its snapshot was saved) while the server never
 * recorded it. Each toggle writes the wanted state here first; a completed request clears it; on
 * the next load, anything left is replayed against the server's list (see AppContext).
 */

const KEY = 'zz_like_outbox_v1'

/** cardId -> the liked state the user last asked for. */
export type LikeOutbox = Record<string, boolean>

export function readLikeOutbox(): LikeOutbox {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    if (!parsed || typeof parsed !== 'object') return {}
    const out: LikeOutbox = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'boolean') out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

function write(box: LikeOutbox): void {
  try {
    if (Object.keys(box).length === 0) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(box))
  } catch {
    /* quota */
  }
}

export function queueLikeIntent(cardId: string, liked: boolean): void {
  const box = readLikeOutbox()
  box[cardId] = liked
  write(box)
}

/** Clear an entry once the server has answered for it — only if it still holds the same intent. */
export function settleLikeIntent(cardId: string, liked: boolean): void {
  const box = readLikeOutbox()
  if (box[cardId] !== liked) return
  delete box[cardId]
  write(box)
}

export function clearLikeOutbox(): void {
  write({})
}
