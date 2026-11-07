'use client'

import ZoneModalCloseLink from '@/app/components/ZoneModalCloseLink'
import { useCallback, useMemo, useRef, useState, useEffect, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/lib/routes'
import { useApp, type ProfileAge } from '@/app/context/AppContext'
import { buildZoneViewModel } from '@/lib/logic/zone'
import type { ZoneViewModel, ZoneJourneyCard, ZoneTipCard } from '@/lib/logic/zone'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { getJourneyCardTextHex } from '@/lib/journeyColors'
import { parseMoneyGbpFromDisplay, parseCarbonKgFromDisplay, formatZoneCardMoney } from '@/lib/format'
import { StampedMoneyGbp, StampedCarbonKg } from '@/app/components/StampedMetric'
import { motion } from 'framer-motion'
import {
  familyPageEnterProps,
  FAMILY_TRANSITION_SHORT,
} from '@/lib/motion-family'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import { readZaiLikes, removeZaiLike } from '@/lib/zai/zaiLikesStorage'
import { resolveZaiPickHandoff, inferZaiCtaLabel } from '@/lib/zai/resolveZaiLikeHandoff'
import { LikesCardActionTrinity } from '@/app/components/LikesCardActionTrinity'
import { LikesSwipeRow } from '@/app/components/LikesSwipeRow'
import {
  readAllLikeCardSnapshots,
  readLikeCardSnapshot,
  removeLikeCardSnapshot,
} from '@/lib/client/likeCardSnapshots'
import type { JourneyId as LikeJourneyId } from '@/lib/journeys'
import { isValidZoneCardSlug, libraryActionForAnyCardId } from '@/lib/actions/actionLibrary'
import { clearGuestCompletion, markGuestCompleted, readGuestCompletions } from '@/lib/actions/actionCompletion'
import { authenticatedPost } from '@/lib/client/authenticatedFetch'
import { typicalSavingForLibraryCard } from '@/lib/zone/recCardFromZone'
import type { TypicalSaving } from '@/lib/zone/recCard'
import type { ActionVerb, ZoneAction } from '@/lib/actions/actionTypes'

type LikedCardEntry = {
  id: string
  journey_key: LikeJourneyId
  title: string
  data?: { money?: string; carbon?: string }
  actions?: { actionUrl?: string; learnUrl?: string }
}

// Card fill is purple for every journey (see EMOTION_GRID_HEX "purple flip") — this list only
// varies which CTA fill colour (pink vs yellow) a given journey's action button gets. It must
// NOT be used to pick body-text colour: that caused headline/stat text to render purple-on-purple
// (invisible) for these five journeys. Use getJourneyCardTextHex() for text colour instead.
const YELLOW_JOURNEY_IDS: JourneyId[] = ['home', 'food', 'money', 'tech', 'holidays']


/** Eyebrow type word and offer label per action verb, so every like says what kind it is and how to act. */
const VERB_TYPE: Record<ActionVerb, string> = { CLAIM: 'Claim', SWITCH: 'Switch', DO: 'To do', BUY: 'Buy' }
const VERB_CTA: Record<ActionVerb, string> = {
  CLAIM: 'Check now',
  SWITCH: 'Compare deals',
  DO: 'See how',
  BUY: 'Compare options',
}

/** "Typical saving a year" / "Average saving a year" / "Maximum saving" — the figure's own wording from its source. */
function typicalSavingLabel(t: TypicalSaving): string {
  const base = t.phrase === 'up_to' ? 'Maximum saving' : t.phrase === 'average' ? 'Average saving' : 'Typical saving'
  return t.perYear ? `${base} a year` : base
}

/** Where tapping a liked card opens it: journey cards have /zone/card URLs; habit cards use ?open=. */
function likeOpenHref(cardId: string): string | null {
  if (cardId.startsWith('journey-')) {
    const slug = cardId.slice('journey-'.length)
    return isValidZoneCardSlug(slug) ? `${ROUTES.ZONE}/card/${slug}` : null
  }
  if (cardId.startsWith('rock-')) return `${ROUTES.ZONE}?open=${encodeURIComponent(cardId)}`
  return null
}

const UNDO_MS = 5000
const CHEER_MS = 1600
const DONE_PREVIEW = 3
const SORT_KEY = 'zz_likes_sort'

/** Guest "done" key: the library action id when the card has one (shared with the Zone ranker), else the card id. */
function doneKeyFor(cardId: string): string {
  return libraryActionForAnyCardId(cardId)?.id ?? cardId
}

function categoryLabel(category: string): string {
  const c = String(category || 'other').replace(/-/g, ' ')
  return c.charAt(0).toUpperCase() + c.slice(1)
}

function likeEyebrow(journeyKey: string | null | undefined, action: ZoneAction | null): string {
  const category = String(journeyKey || 'card').replace(/-/g, ' ')
  const cat = category.charAt(0).toUpperCase() + category.slice(1)
  return action ? `${VERB_TYPE[action.verb]} · ${cat}` : cat
}

export default function LikesPage() {
  const reduceMotion = useHydrationSafeReducedMotion()
  const pageEnter = familyPageEnterProps(reduceMotion)
  const { state, toggleLike } = useApp()
  const [serverActionedIds, setActionedIds] = useState<Set<string>>(new Set())
  // Guests can't use /api/actioned (signed-in only); their "done" lives on this device.
  const [guestDoneKeys, setGuestDoneKeys] = useState<Set<string>>(new Set())
  useEffect(() => {
    setGuestDoneKeys(new Set(readGuestCompletions().map((r) => r.actionId)))
  }, [])
  const viewModel = useMemo(() => {
    const journeyAnswers = {} as Record<JourneyId, Record<string, string>>
    if (typeof window === 'undefined') return null
    JOURNEY_ORDER.forEach((jid) => {
      try {
        const raw = localStorage.getItem(`journey_${jid}_answers`)
        if (raw) journeyAnswers[jid] = JSON.parse(raw)
      } catch {
        //
      }
    })
    const validAges: ProfileAge[] = ['JUNIOR', 'MID', 'RETIRED']
    const ageRaw = state.profile?.age
    const age: ProfileAge | undefined =
      ageRaw && validAges.includes(ageRaw as ProfileAge) ? (ageRaw as ProfileAge) : undefined
    const profile = state.profile
      ? {
          name: state.profile.name,
          postcode: state.profile.postcode,
          household: state.profile.livingSituation,
          home_type: state.profile.homeType,
          transport_baseline: state.profile.transport,
          age,
          employment_status: state.profile.employmentStatus?.trim() || undefined,
        }
      : {}
    return buildZoneViewModel({ profile, journeyAnswers })
  }, [state.profile])

  useEffect(() => {
    let cancelled = false
    // One retry on a transient blip — a dropped GET here used to silently read as "nothing
    // actioned," which could bring already-actioned cards back onto the Likes wall.
    const load = async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const res = await fetch('/api/actioned', { credentials: 'include' })
          if (!res.ok) throw new Error(`actioned GET failed: ${res.status}`)
          const data = await res.json()
          if (!cancelled) {
            setActionedIds(new Set(Array.isArray(data?.actioned_card_ids) ? data.actioned_card_ids : []))
          }
          return
        } catch (err) {
          if (attempt === 1) console.error('[likes] loading actioned cards failed:', err)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * Potential only: show liked cards that are NOT yet actioned (actioned = Truth, vanish from Likes).
   * Snapshot (saved at like-time, keyed by the exact card id liked) is the primary source — it
   * covers Rock-merged recommendation tiles and morph/discovery cards whose ids never appear in
   * the current viewModel.journeys/tips (those two lists are a fixed 13 + a rotating, capped rail).
   * Falling back to viewModel-only membership silently dropped every one of those from /likes even
   * though the like was correctly recorded server-side and in the snapshot.
   */
  // Until /api/likes answers, draw from this device's like snapshots so the wall paints at once
  // instead of flashing "No likes yet"; the server list replaces it as soon as it lands.
  // Read after mount only: the server render has no localStorage, so reading it in the first
  // client render would not match the server HTML (hydration error).
  const [cachedLikeIds, setCachedLikeIds] = useState<string[]>([])
  useEffect(() => {
    setCachedLikeIds([...Object.keys(readAllLikeCardSnapshots()), ...readZaiLikes().map((z) => z.id)])
  }, [])
  const likedIdList = useMemo(() => {
    if (state.likesLoaded || (state.likedCards ?? []).length > 0) return state.likedCards ?? []
    return cachedLikeIds
  }, [state.likesLoaded, state.likedCards, cachedLikeIds])

  const doneIdsAll = useMemo(() => {
    if (guestDoneKeys.size === 0) return serverActionedIds
    const next = new Set(serverActionedIds)
    for (const id of likedIdList) if (guestDoneKeys.has(doneKeyFor(id))) next.add(id)
    return next
  }, [serverActionedIds, guestDoneKeys, likedIdList])

  // A card just marked done stays on the wall for a moment with a short "Nice one" before it
  // moves to Done, so the jump isn't abrupt. Filters use actionedIds (without it); the card's own
  // Done state uses doneIdsAll.
  const [celebratingId, setCelebratingId] = useState<string | null>(null)
  useEffect(() => {
    if (!celebratingId) return
    const t = window.setTimeout(() => setCelebratingId(null), CHEER_MS)
    return () => window.clearTimeout(t)
  }, [celebratingId])
  const actionedIds = useMemo(() => {
    if (!celebratingId || !doneIdsAll.has(celebratingId)) return doneIdsAll
    const next = new Set(doneIdsAll)
    next.delete(celebratingId)
    return next
  }, [doneIdsAll, celebratingId])

  // Sort: biggest saving (grouped by category, the default) or newest first (one list).
  const [sortMode, setSortMode] = useState<'saving' | 'newest'>('saving')
  useEffect(() => {
    try {
      if (localStorage.getItem(SORT_KEY) === 'newest') setSortMode('newest')
    } catch {
      /* default */
    }
  }, [])
  const chooseSort = (mode: 'saving' | 'newest') => {
    setSortMode(mode)
    try {
      localStorage.setItem(SORT_KEY, mode)
    } catch {
      /* per-device nicety only */
    }
  }
  const [showAllDone, setShowAllDone] = useState(false)

  const likedCards = useMemo(() => {
    const likedIds = likedIdList
    if (likedIds.length === 0) return []
    const notActioned = (id: string) => !actionedIds.has(id)
    const result: LikedCardEntry[] = []
    for (const id of likedIds) {
      if (!notActioned(id)) continue
      const snap = readLikeCardSnapshot(id)
      if (snap) {
        result.push({
          id,
          journey_key: snap.journey_key,
          title: snap.title,
          data: { money: snap.money, carbon: snap.carbon },
          actions: snap.offerUrl ? { actionUrl: snap.offerUrl } : undefined,
        })
        continue
      }
      const fromViewModel =
        viewModel?.journeys.find((c) => c.id === id) ?? viewModel?.tips.find((c) => c.id === id)
      if (fromViewModel) result.push(fromViewModel as unknown as LikedCardEntry)
    }
    return result
  }, [viewModel, likedIdList, actionedIds])

  const likedZaiPicks = useMemo(() => {
    const likedIds = new Set(likedIdList)
    return readZaiLikes().filter((z) => likedIds.has(z.id) && !actionedIds.has(z.id))
  }, [likedIdList, actionedIds])

  const hasLikes = likedCards.length > 0 || likedZaiPicks.length > 0

  const handleUnlike = (id: string) => {
    // toggleLike (AppContext) already persists this to /api/likes itself, awaiting a real
    // session first. A second, unawaited POST here used to race it: this one usually reached the
    // server first (delete), then toggleLike's session-gated request landed after and re-inserted
    // the like — so an unliked card could silently reappear on next load.
    toggleLike(id)
    removeLikeCardSnapshot(id)
    if (id.startsWith('zai-like-')) removeZaiLike(id)
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([12, 60, 12])
  }

  // Remove waits UNDO_MS before it is committed, so "Undo" never has to re-create a like.
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)
  const pendingRemoveRef = useRef<{ id: string; timer: number } | null>(null)
  const handleUnlikeRef = useRef(handleUnlike)
  handleUnlikeRef.current = handleUnlike
  const commitPendingRemove = useCallback(() => {
    const p = pendingRemoveRef.current
    if (!p) return
    window.clearTimeout(p.timer)
    pendingRemoveRef.current = null
    handleUnlikeRef.current(p.id)
    setPendingRemoveId(null)
  }, [])
  const requestRemove = (id: string) => {
    commitPendingRemove()
    const timer = window.setTimeout(commitPendingRemove, UNDO_MS)
    pendingRemoveRef.current = { id, timer }
    setPendingRemoveId(id)
  }
  const undoRemove = () => {
    const p = pendingRemoveRef.current
    if (p) window.clearTimeout(p.timer)
    pendingRemoveRef.current = null
    setPendingRemoveId(null)
  }
  // Leaving the page commits a pending Remove rather than dropping it.
  useEffect(() => () => commitPendingRemove(), [commitPendingRemove])

  const router = useRouter()
  const openFromCard = (href: string | null) => (e: MouseEvent<HTMLElement>) => {
    if (!href || (e.target as HTMLElement).closest('button, a')) return
    router.push(href)
  }
  const openFromKey = (href: string | null) => (e: KeyboardEvent<HTMLElement>) => {
    if (!href || e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      router.push(href)
    }
  }

  const [failedActionIds, setFailedActionIds] = useState<Set<string>>(new Set())

  // authenticatedPost restores an expired session first (and retries once on 401), like likes do.
  const postActioned = (id: string) => authenticatedPost('/api/actioned', { card_id: id })

  /**
   * A silently-dropped click here reads as "the button did nothing" — nothing else on the card
   * changes on failure, so the tap looks broken rather than actually broken. One retry rides out
   * a transient network blip before we tell the user; a real failure now surfaces a clear inline
   * message instead of vanishing into an empty catch.
   */
  const handleActioned = async (id: string) => {
    setFailedActionIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    const marking = !doneIdsAll.has(id)
    try {
      let res = await postActioned(id)
      if (res.status === 401) {
        // Not signed in: keep "done" on this device, the same store the Zone ranker reads.
        const key = doneKeyFor(id)
        const rows = guestDoneKeys.has(key) ? clearGuestCompletion(key) : markGuestCompleted(key)
        setGuestDoneKeys(new Set(rows.map((r) => r.actionId)))
        if (marking) setCelebratingId(id)
        return
      }
      if (!res.ok) res = await postActioned(id)
      if (!res.ok) throw new Error(`actioned POST failed: ${res.status}`)
      const data = await res.json()
      setActionedIds((prev) => {
        const next = new Set(prev)
        if (data.actioned) next.add(id)
        else next.delete(id)
        return next
      })
      if (data.actioned && marking) setCelebratingId(id)
    } catch (err) {
      console.error('[likes] mark actioned failed:', err)
      setFailedActionIds((prev) => new Set(prev).add(id))
    }
  }

  type LikeItem = { id: string; category: string; gbp: number; kg: number; el: ReactNode }
  const likeItems: LikeItem[] = [
    ...likedZaiPicks.map((pick): LikeItem => {
            const textColor = 'var(--color-blue)'
            const gbp = parseMoneyGbpFromDisplay(pick.money)
            const kg = parseCarbonKgFromDisplay(pick.carbon)
            const isActioned = doneIdsAll.has(pick.id)
            const handoff = resolveZaiPickHandoff(pick, state.profile?.postcode)
                        return { id: pick.id, category: String(pick.journey_key || 'other'), gbp, kg, el: (
              <article
                key={pick.id}
                className="settings-card-cell likes-card-cell"
                data-field-quiet
              >
              <div
                className="bento-card-groovy likes-bento-card zz-family-bloom flex flex-col justify-between w-full h-full zz-brand zzb-card"
              >
                <span className="card-top-label" style={{ color: textColor }}>
                  {`Zai pick · ${likeEyebrow(pick.journey_key, null)}`}
                </span>
                <h3 className="card-headline m-0 min-w-0" style={{ color: textColor }}>
                  {pick.title}
                </h3>
                {gbp > 0 || kg > 0 ? (
                <div className="card-impact-grid grid grid-cols-2 gap-x-4 gap-y-0">
                  {gbp > 0 ? (
                  <div className="data-stack data-stack--tight">
                    <span className="data-label text-data" style={{ color: textColor }}>SAVE</span>
                    <span className="data-value text-data data-stamp-metric" style={{ color: 'var(--color-ink)' }}>
                      <StampedMoneyGbp gbp={gbp} />
                    </span>
                  </div>
                  ) : null}
                  {kg > 0 ? (
                  <div className="data-stack data-stack--tight">
                    <span className="data-label text-data" style={{ color: textColor }}>CARBON</span>
                    <span className="data-value text-data data-stamp-metric" style={{ color: 'var(--color-ink)' }}>
                      <StampedCarbonKg kg={kg} />
                    </span>
                  </div>
                  ) : null}
                </div>
                ) : null}
                <LikesCardActionTrinity
                  offerUrl={handoff.offerUrl}
                  journeyKey={pick.journey_key}
                  moneyGbp={gbp}
                  ctaLabel={handoff.ctaLabel}
                  ctaSurface="pink"
                  isActioned={isActioned}
                  removeDisabled={!state.likesLoaded}
                  onUnlike={() => requestRemove(pick.id)}
                  onActioned={() => void handleActioned(pick.id)}
                />
                {celebratingId === pick.id ? (
                  <p className="zzb-meta likes-card-cheer m-0" role="status">Nice one. Moving it to Done.</p>
                ) : null}
                {failedActionIds.has(pick.id) ? (
                  <p className="card-top-label m-0" style={{ color: textColor }}>
                    Couldn&apos;t save. Tap Mark done to try again.
                  </p>
                ) : null}
              </div>
              </article>
            ) }
    }),
    ...likedCards.map((card): LikeItem => {
            const journeyKey = card.journey_key
            const snap = readLikeCardSnapshot(card.id)
            const textColor = getJourneyCardTextHex(journeyKey)
            const gbp = parseMoneyGbpFromDisplay(snap?.money ?? String(card.data?.money ?? '0'))
            const kg = parseCarbonKgFromDisplay(snap?.carbon ?? String(card.data?.carbon ?? '0'))
            const isActioned = doneIdsAll.has(card.id)
            const libAction = libraryActionForAnyCardId(card.id)
            const savedOfferUrl =
              snap?.offerUrl ??
              ('actions' in card && card.actions
                ? (card.actions as { actionUrl?: string; learnUrl?: string }).actionUrl ??
                  (card.actions as { learnUrl?: string }).learnUrl
                : undefined)
            // No link saved with the like: fall back to the card's own library action so every like can be acted on.
            const offerUrl = savedOfferUrl ?? libAction?.url
            const headline = snap?.title?.trim() || card.title
            // Source under the figure, only when the library text states that amount (same rule as Zone cards).
            const typical = gbp > 0 ? typicalSavingForLibraryCard(card.id) : null
            const zoneCtaLabel = savedOfferUrl
              ? inferZaiCtaLabel(journeyKey, headline, savedOfferUrl)
              : libAction
                ? VERB_CTA[libAction.verb]
                : 'CLAIM'
            const openHref = likeOpenHref(card.id)
            return { id: card.id, category: String(journeyKey || 'other'), gbp, kg, el: (
              <article
                key={card.id}
                className={`settings-card-cell likes-card-cell${openHref ? ' likes-card-cell--openable' : ''}`}
                onClick={openFromCard(openHref)}
                onKeyDown={openFromKey(openHref)}
                tabIndex={openHref ? 0 : undefined}
                aria-label={openHref ? `Open ${headline}` : undefined}
              >
              <div
                className="bento-card-groovy likes-bento-card zz-family-bloom zone-bento-card flex flex-col justify-between w-full h-full zz-brand zzb-card"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="card-top-label" style={{ color: textColor }}>
                    {likeEyebrow(journeyKey, libAction)}
                  </span>
                </div>
                <h3 className="card-headline m-0 min-w-0 zone-bento-headline" style={{ color: textColor }}>
                  {headline}
                </h3>
                {gbp > 0 || kg > 0 ? (
                <div className="card-impact-grid grid grid-cols-2 gap-x-4 gap-y-0" style={{ color: textColor }}>
                  {gbp > 0 ? (
                  <div className="data-stack data-stack--tight">
                    <span className="data-label text-data" style={{ color: textColor }}>SAVE</span>
                    <span className="data-value text-data data-stamp-metric" style={{ color: 'var(--color-ink)' }}>
                      <StampedMoneyGbp gbp={gbp} />
                    </span>
                  </div>
                  ) : null}
                  {kg > 0 ? (
                  <div className="data-stack data-stack--tight data-stack--secondary">
                    <span className="data-label" style={{ color: textColor }}>CARBON</span>
                    <span className="data-value data-stamp-metric" style={{ color: 'var(--color-ink)' }}>
                      <StampedCarbonKg kg={kg} />
                    </span>
                  </div>
                  ) : null}
                </div>
                ) : null}
                {typical ? (
                  <p className="zzb-meta likes-card-source m-0" data-testid="likes-card-source">
                    {typicalSavingLabel(typical)} · Source: {typical.source.name}
                  </p>
                ) : null}
                <LikesCardActionTrinity
                  offerUrl={offerUrl}
                  journeyKey={journeyKey}
                  moneyGbp={gbp}
                  ctaLabel={zoneCtaLabel}
                  ctaSurface={YELLOW_JOURNEY_IDS.includes(journeyKey) ? 'yellow' : 'pink'}
                  isActioned={isActioned}
                  removeDisabled={!state.likesLoaded}
                  onUnlike={() => requestRemove(card.id)}
                  onActioned={() => void handleActioned(card.id)}
                />
                {celebratingId === card.id ? (
                  <p className="zzb-meta likes-card-cheer m-0" role="status">Nice one. Moving it to Done.</p>
                ) : null}
                {failedActionIds.has(card.id) ? (
                  <p className="card-top-label m-0" style={{ color: textColor }}>
                    Couldn&apos;t save. Tap Mark done to try again.
                  </p>
                ) : null}
              </div>
              </article>
            ) }
    }),
  ]
  // Biggest saving first (ties keep saved order; sort is stable), or newest like first.
  const likedOrder = new Map(likedIdList.map((id, i) => [id, i]))
  if (sortMode === 'newest') likeItems.sort((a, b) => (likedOrder.get(b.id) ?? -1) - (likedOrder.get(a.id) ?? -1))
  else likeItems.sort((a, b) => b.gbp - a.gbp)
  const shownItems = pendingRemoveId ? likeItems.filter((i) => i.id !== pendingRemoveId) : likeItems
  const showWall = hasLikes && shownItems.length > 0
  const totalGbp = shownItems.reduce((n, i) => n + i.gbp, 0)
  const totalKg = shownItems.reduce((n, i) => n + i.kg, 0)

  // Group by category, biggest group first; items keep their biggest-saving-first order.
  const groups = (() => {
    if (sortMode === 'newest') return [{ category: 'newest', items: shownItems, gbp: 0 }]
    const map = new Map<string, LikeItem[]>()
    for (const i of shownItems) map.set(i.category, [...(map.get(i.category) ?? []), i])
    return [...map.entries()]
      .map(([category, items]) => ({ category, items, gbp: items.reduce((n, i) => n + i.gbp, 0) }))
      .sort((a, b) => b.gbp - a.gbp)
  })()
  const showGroupHeadings = groups.length > 1

  // Done: liked cards marked done. They leave the grid but stay listed here, with a way back.
  const doneItems = [...likedIdList]
    .reverse() // newest like first
    .filter((id) => actionedIds.has(id) && id !== pendingRemoveId)
    .map((id) => {
      const snap = readLikeCardSnapshot(id)
      const zai = snap ? null : readZaiLikes().find((z) => z.id === id)
      const title = snap?.title?.trim() || zai?.title || null
      if (!title) return null
      const gbp = parseMoneyGbpFromDisplay(snap?.money ?? zai?.money ?? '0')
      return { id, title, gbp, category: String(snap?.journey_key ?? zai?.journey_key ?? '') }
    })
    .filter((d): d is { id: string; title: string; gbp: number; category: string } => d !== null)
  const doneGbp = doneItems.reduce((n, d) => n + d.gbp, 0)
  // Progress across everything liked: done vs still waiting.
  const progressTotal = shownItems.length + doneItems.length
  const showProgress = doneItems.length > 0 && progressTotal > 0
  const progressPct = progressTotal > 0 ? Math.round((doneItems.length / progressTotal) * 100) : 0

  return (
    <motion.div
      className="zz-page likes-page mode-carbon"
      style={{
        background: 'unset',
        color: 'var(--color-blue)',
        minHeight: '100vh',
      }}
      initial={pageEnter.initial}
      animate={pageEnter.animate}
      transition={pageEnter.transition}
    >
      <ZoneModalCloseLink />

      <div className="settings-heading-wrap zz-brand likes-heading--brand">
        <h3 className="zz-page-title zzb-h2 zzb-ink" data-field-quiet>{showWall || doneItems.length > 0 || !state.likesLoaded ? 'Likes' : 'No likes yet'}</h3>
        {showWall ? (
          <p className="zzb-lede zzb-muted likes-total m-0" data-field-quiet data-testid="likes-total">
            {shownItems.length} saved
            {totalGbp > 0 ? ` · worth up to ${formatZoneCardMoney(totalGbp)}` : ''}
            {totalKg > 0 ? ` · ${Math.round(totalKg).toLocaleString('en-GB')}\u00a0kg\u00a0CO₂ less` : ''}
          </p>
        ) : null}
        {showProgress ? (
          <div className="likes-progress" data-testid="likes-progress">
            <div
              className="likes-progress__bar"
              role="progressbar"
              aria-label="Likes done"
              aria-valuemin={0}
              aria-valuemax={progressTotal}
              aria-valuenow={doneItems.length}
            >
              <motion.span
                className="likes-progress__fill"
                initial={false}
                animate={{ width: `${progressPct}%` }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <p className="zzb-meta likes-progress__text m-0">
              {`You've done ${doneItems.length} of ${progressTotal}`}
              {doneGbp > 0 ? ` · ${formatZoneCardMoney(doneGbp)} of ${formatZoneCardMoney(doneGbp + totalGbp)}` : ''}
            </p>
          </div>
        ) : null}
        {!showWall && doneItems.length === 0 && state.likesLoaded ? (
          <div className="likes-empty" data-testid="likes-empty">
            <p className="zzb-lede zzb-muted m-0" data-field-quiet>Tap Save on any card to keep it here.</p>
            <Link href={ROUTES.ZONE} className="zzb-link likes-empty__link">
              Back to your Zone →
            </Link>
          </div>
        ) : null}
      </div>

      {showWall && shownItems.length > 1 ? (
        <div className="zz-brand likes-sort" role="group" aria-label="Sort likes">
          <span className="zzb-meta">Sort</span>
          <button type="button" className="zzb-chip likes-sort__opt" aria-pressed={sortMode === 'saving'} onClick={() => chooseSort('saving')}>
            Biggest saving
          </button>
          <button type="button" className="zzb-chip likes-sort__opt" aria-pressed={sortMode === 'newest'} onClick={() => chooseSort('newest')}>
            Newest
          </button>
        </div>
      ) : null}

      {showWall
        ? groups.map((g) => (
            <section
              key={g.category}
              className="settings-grid-wrap zz-brand likes-group"
              aria-label={sortMode === 'newest' ? 'Newest first' : categoryLabel(g.category)}
            >
              {showGroupHeadings && sortMode === 'saving' ? (
                <h2 className="zzb-eyebrow likes-group__title" data-field-quiet>
                  <span>{categoryLabel(g.category)}</span>
                  {g.gbp > 0 ? <span className="likes-group__sum">{` · ${formatZoneCardMoney(g.gbp)}`}</span> : null}
                </h2>
              ) : null}
              <motion.div
                className="settings-answer-grid likes-answer-grid"
                initial={pageEnter.initial}
                animate={pageEnter.animate}
                transition={FAMILY_TRANSITION_SHORT}
              >
                {g.items.map((i) => (
                  <LikesSwipeRow key={i.id} onRemove={() => requestRemove(i.id)} disabled={!state.likesLoaded}>
                    {i.el}
                  </LikesSwipeRow>
                ))}
              </motion.div>
            </section>
          ))
        : null}

      {doneItems.length > 0 ? (
        <section className="zz-brand likes-done" aria-label="Done">
          <h2 className="zzb-eyebrow likes-group__title" data-field-quiet>
            <span>Done</span>
            <span className="likes-group__sum">
              {` · ${doneItems.length}`}
              {doneGbp > 0 ? ` · worth up to ${formatZoneCardMoney(doneGbp)}` : ''}
            </span>
          </h2>
          <ul className="likes-done__list" data-field-quiet>
            {(showAllDone ? doneItems : doneItems.slice(0, DONE_PREVIEW)).map((d) => (
              <li key={d.id} className="likes-done__row">
                <span className="likes-done__check" aria-hidden>✓</span>
                <span className="zzb-body likes-done__title">{d.title}</span>
                {d.gbp > 0 ? <span className="zzb-meta likes-done__gbp">{formatZoneCardMoney(d.gbp)}</span> : null}
                <button
                  type="button"
                  className="zzb-link likes-done__undo"
                  onClick={() => void handleActioned(d.id)}
                  aria-label={`Move ${d.title} back to your likes`}
                >
                  Not done
                </button>
              </li>
            ))}
          </ul>
          {doneItems.length > DONE_PREVIEW ? (
            <button
              type="button"
              className="zzb-link likes-done__more"
              aria-expanded={showAllDone}
              onClick={() => setShowAllDone((v) => !v)}
            >
              {showAllDone ? 'Show fewer' : `Show all (${doneItems.length})`}
            </button>
          ) : null}
        </section>
      ) : null}

      {pendingRemoveId ? (
        <div className="zz-brand likes-undo" role="status" aria-live="polite">
          <span className="zzb-body">Removed from likes.</span>
          <button type="button" className="zzb-link likes-undo__btn" onClick={undoRemove}>
            Undo
          </button>
        </div>
      ) : null}
    </motion.div>
  )
}
