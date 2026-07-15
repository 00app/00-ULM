'use client'

import ZoneModalCloseLink from '@/app/components/ZoneModalCloseLink'
import { useMemo, useState, useEffect } from 'react'
import { ROUTES } from '@/lib/routes'
import { useApp, type ProfileAge } from '@/app/context/AppContext'
import { buildZoneViewModel } from '@/lib/logic/zone'
import type { ZoneViewModel, ZoneJourneyCard, ZoneTipCard } from '@/lib/logic/zone'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { getJourneyColorHex, getJourneyCardTextHex } from '@/lib/journeyColors'
import { parseMoneyGbpFromDisplay, parseCarbonKgFromDisplay } from '@/lib/format'
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
import { readLikeCardSnapshot, removeLikeCardSnapshot } from '@/lib/client/likeCardSnapshots'
import type { JourneyId as LikeJourneyId } from '@/lib/journeys'

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

export default function LikesPage() {
  const reduceMotion = useHydrationSafeReducedMotion()
  const pageEnter = familyPageEnterProps(reduceMotion)
  const { state, toggleLike } = useApp()
  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set())
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
    fetch('/api/actioned', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { actioned_card_ids: [] }))
      .then((data) => setActionedIds(new Set(Array.isArray(data?.actioned_card_ids) ? data.actioned_card_ids : [])))
      .catch(() => setActionedIds(new Set()))
  }, [])

  /**
   * Potential only: show liked cards that are NOT yet actioned (actioned = Truth, vanish from Likes).
   * Snapshot (saved at like-time, keyed by the exact card id liked) is the primary source — it
   * covers Rock-merged recommendation tiles and morph/discovery cards whose ids never appear in
   * the current viewModel.journeys/tips (those two lists are a fixed 13 + a rotating, capped rail).
   * Falling back to viewModel-only membership silently dropped every one of those from /likes even
   * though the like was correctly recorded server-side and in the snapshot.
   */
  const likedCards = useMemo(() => {
    const likedIds = state.likedCards ?? []
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
  }, [viewModel, state.likedCards, actionedIds])

  const likedZaiPicks = useMemo(() => {
    const likedIds = new Set(state.likedCards ?? [])
    return readZaiLikes().filter((z) => likedIds.has(z.id) && !actionedIds.has(z.id))
  }, [state.likedCards, actionedIds])

  const hasLikes = likedCards.length > 0 || likedZaiPicks.length > 0

  const handleUnlike = (id: string) => {
    toggleLike(id)
    removeLikeCardSnapshot(id)
    if (id.startsWith('zai-like-')) removeZaiLike(id)
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([12, 60, 12])
    fetch('/api/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ card_id: id }),
    }).catch(() => {})
  }

  const handleActioned = async (id: string) => {
    try {
      const res = await fetch('/api/actioned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ card_id: id }),
      })
      if (res.ok) {
        const data = await res.json()
        setActionedIds((prev) => {
          const next = new Set(prev)
          if (data.actioned) next.add(id)
          else next.delete(id)
          return next
        })
      }
    } catch {
      //
    }
  }

  return (
    <motion.div
      className="zz-page likes-page mode-carbon"
      style={{
        background: 'unset',
        color: 'var(--color-yellow)',
        minHeight: '100vh',
      }}
      initial={pageEnter.initial}
      animate={pageEnter.animate}
      transition={pageEnter.transition}
    >
      <ZoneModalCloseLink />

      <div className="settings-heading-wrap">
        <h3 className="zz-page-title">{hasLikes ? 'Likes' : 'no likes'}</h3>
      </div>

      {hasLikes ? (
        <div className="settings-grid-wrap">
          <motion.div
            className="settings-answer-grid likes-answer-grid"
            initial={pageEnter.initial}
            animate={pageEnter.animate}
            transition={FAMILY_TRANSITION_SHORT}
          >
          {likedZaiPicks.map((pick) => {
            const textColor = 'var(--color-yellow)'
            const gbp = parseMoneyGbpFromDisplay(pick.money)
            const kg = parseCarbonKgFromDisplay(pick.carbon)
            const isActioned = actionedIds.has(pick.id)
            const handoff = resolveZaiPickHandoff(pick, state.profile?.postcode)
            return (
              <article
                key={pick.id}
                className="settings-card-cell likes-card-cell"
              >
              <div
                className="bento-card-groovy likes-bento-card zz-family-bloom flex flex-col justify-between w-full h-full"
                style={{
                  background: 'var(--color-pink)',
                  color: textColor,
                  ['--color-ink' as string]: textColor,
                }}
              >
                <span className="card-top-label" style={{ color: textColor }}>ZAI PICK</span>
                <h3 className="card-headline m-0 min-w-0" style={{ color: textColor }}>
                  {pick.title}
                </h3>
                <div className="card-impact-grid grid grid-cols-2 gap-x-4 gap-y-0">
                  <div className="data-stack data-stack--tight">
                    <span className="data-label text-data" style={{ color: textColor }}>SAVE</span>
                    <span className="data-value text-data data-stamp-metric" style={{ color: 'var(--color-ink)' }}>
                      <StampedMoneyGbp gbp={gbp} />
                    </span>
                  </div>
                  <div className="data-stack data-stack--tight">
                    <span className="data-label text-data" style={{ color: textColor }}>CARBON</span>
                    <span className="data-value text-data data-stamp-metric" style={{ color: 'var(--color-ink)' }}>
                      <StampedCarbonKg kg={kg} />
                    </span>
                  </div>
                </div>
                <LikesCardActionTrinity
                  offerUrl={handoff.offerUrl}
                  journeyKey={pick.journey_key}
                  moneyGbp={gbp}
                  ctaLabel={handoff.ctaLabel}
                  ctaSurface="pink"
                  isActioned={isActioned}
                  onUnlike={() => handleUnlike(pick.id)}
                  onActioned={() => void handleActioned(pick.id)}
                />
              </div>
              </article>
            )
          })}
          {likedCards.map((card) => {
            const journeyKey = card.journey_key
            const snap = readLikeCardSnapshot(card.id)
            const bg = getJourneyColorHex(journeyKey)
            const textColor = getJourneyCardTextHex(journeyKey)
            const gbp = parseMoneyGbpFromDisplay(snap?.money ?? String(card.data?.money ?? '0'))
            const kg = parseCarbonKgFromDisplay(snap?.carbon ?? String(card.data?.carbon ?? '0'))
            const isActioned = actionedIds.has(card.id)
            const offerUrl =
              snap?.offerUrl ??
              ('actions' in card && card.actions
                ? (card.actions as { actionUrl?: string; learnUrl?: string }).actionUrl ??
                  (card.actions as { learnUrl?: string }).learnUrl
                : undefined)
            const headline = snap?.title?.trim() || card.title
            const zoneCtaLabel = offerUrl
              ? inferZaiCtaLabel(journeyKey, headline, offerUrl)
              : 'CLAIM'
            return (
              <article
                key={card.id}
                className="settings-card-cell likes-card-cell"
              >
              <div
                className="bento-card-groovy likes-bento-card zz-family-bloom zone-bento-card flex flex-col justify-between w-full h-full"
                style={{
                  background: bg,
                  color: textColor,
                  ['--color-ink' as string]: textColor,
                  boxShadow: 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="card-top-label" style={{ color: textColor }}>
                    {(journeyKey || 'CARD').replace(/-/g, ' ').toUpperCase()}
                  </span>
                </div>
                <h3 className="card-headline m-0 min-w-0 zone-bento-headline" style={{ color: textColor }}>
                  {headline}
                </h3>
                <div className="card-impact-grid grid grid-cols-2 gap-x-4 gap-y-0" style={{ color: textColor }}>
                  <div className="data-stack data-stack--tight">
                    <span className="data-label text-data" style={{ color: textColor }}>SAVE</span>
                    <span className="data-value text-data data-stamp-metric" style={{ color: 'var(--color-ink)' }}>
                      <StampedMoneyGbp gbp={gbp} />
                    </span>
                  </div>
                  <div className="data-stack data-stack--tight data-stack--secondary">
                    <span className="data-label" style={{ color: textColor }}>CARBON</span>
                    <span className="data-value data-stamp-metric" style={{ color: 'var(--color-ink)' }}>
                      <StampedCarbonKg kg={kg} />
                    </span>
                  </div>
                </div>
                <LikesCardActionTrinity
                  offerUrl={offerUrl}
                  journeyKey={journeyKey}
                  moneyGbp={gbp}
                  ctaLabel={zoneCtaLabel}
                  ctaSurface={YELLOW_JOURNEY_IDS.includes(journeyKey) ? 'yellow' : 'pink'}
                  isActioned={isActioned}
                  onUnlike={() => handleUnlike(card.id)}
                  onActioned={() => void handleActioned(card.id)}
                />
              </div>
              </article>
            )
          })}
          </motion.div>
        </div>
      ) : null}
    </motion.div>
  )
}
