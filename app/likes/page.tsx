'use client'

import Link from 'next/link'
import ZoneBackToZoneLink from '@/app/components/ZoneBackToZoneLink'
import { useMemo, useState, useEffect } from 'react'
import { ROUTES } from '@/lib/routes'
import { useApp, type ProfileAge } from '@/app/context/AppContext'
import { buildZoneViewModel } from '@/lib/logic/zone'
import type { ZoneViewModel, ZoneJourneyCard, ZoneTipCard } from '@/lib/logic/zone'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { getJourneyColorHex } from '@/lib/journeyColors'
import { parseMoneyGbpFromDisplay, parseCarbonKgFromDisplay } from '@/lib/format'
import { StampedMoneyGbp, StampedCarbonKg } from '@/app/components/StampedMetric'
import { motion } from 'framer-motion'
import { KINETIC_ZIP_PULSE } from '@/lib/animations'
import { ZoneIntelligenceStrip } from '@/app/components/ZoneIntelligenceStrip'

const YELLOW_JOURNEY_IDS: JourneyId[] = ['home', 'food', 'money', 'tech', 'holidays']

export default function LikesPage() {
  const { state, toggleLike } = useApp()
  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set())
  const [dbConnected, setDbConnected] = useState(true)
  const [dbHealthHint, setDbHealthHint] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/health', { cache: 'no-store' })
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as {
          status?: string
          database?: string
          error?: string
        } | null
        if (cancelled) return
        if (r.ok && body?.status === 'ok' && body?.database === 'connected') {
          setDbConnected(true)
          setDbHealthHint(null)
          return
        }
        setDbConnected(false)
        const hint =
          r.status === 503
            ? typeof body?.error === 'string' && body.error.trim()
              ? body.error.trim()
              : 'Database unreachable — set DATABASE_URL (Neon) in .env.local or Vercel env.'
            : `GET /api/health → HTTP ${r.status}`
        setDbHealthHint(hint)
      })
      .catch(() => {
        if (!cancelled) {
          setDbConnected(false)
          setDbHealthHint('Network error calling /api/health')
        }
      })
    return () => {
      cancelled = true
    }
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
    fetch('/api/actioned', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { actioned_card_ids: [] }))
      .then((data) => setActionedIds(new Set(Array.isArray(data?.actioned_card_ids) ? data.actioned_card_ids : [])))
      .catch(() => setActionedIds(new Set()))
  }, [])

  /** Potential only: show liked cards that are NOT yet actioned (actioned = Truth, vanish from Likes) */
  const likedCards = useMemo(() => {
    const likedIds = state.likedCards ?? []
    if (!viewModel || likedIds.length === 0) return []
    const notActioned = (id: string) => !actionedIds.has(id)
    const journeyCards = viewModel.journeys.filter((c) => likedIds.includes(c.id) && notActioned(c.id))
    const tipCards = viewModel.tips.filter((c) => likedIds.includes(c.id) && notActioned(c.id))
    return [...journeyCards, ...tipCards] as any[]
  }, [viewModel, state.likedCards, actionedIds])

  const handleUnlike = (id: string) => {
    toggleLike(id)
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
        paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))',
      }}
      {...KINETIC_ZIP_PULSE}
    >
      <ZoneBackToZoneLink />
      <h1 className="zz-page-title zai-page-title">
        LIKES
      </h1>
      <p className="zz-body zz-page-intro" style={{ color: 'var(--color-yellow)', textAlign: 'center' }}>
        Cards you’ve liked. Unlike, mark as actioned, or open the link.
      </p>
      {likedCards.length === 0 ? (
        <p className="zz-body" style={{ color: 'var(--color-yellow)', textAlign: 'center' }}>No liked cards yet. Like cards from the Zone to see them here.</p>
      ) : (
        <div className="groovy-zone-grid mx-auto pb-40">
          {likedCards.map((card) => {
            const journeyKey = card.journey_key
            const bg = getJourneyColorHex(journeyKey)
            const textColor = YELLOW_JOURNEY_IDS.includes(journeyKey) ? 'var(--color-purple)' : 'var(--color-yellow)'
            const gbp = parseMoneyGbpFromDisplay(String(card.data?.money ?? '0'))
            const kg = parseCarbonKgFromDisplay(String(card.data?.carbon ?? '0'))
            const isActioned = actionedIds.has(card.id)
            const offerUrl = 'actions' in card && card.actions ? (card.actions as any).actionUrl ?? (card.actions as any).learnUrl : undefined
            return (
              <article
                key={card.id}
                className="bento-card-groovy"
                style={{
                  width: '100%',
                  borderRadius: 60,
                  background: bg,
                  color: textColor,
                  ['--color-ink' as string]: textColor,
                  boxShadow: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="card-top-label" style={{ color: textColor }}>
                    {journeyKey === 'transport' ? 'TRAVEL' : (journeyKey || 'CARD').replace(/-/g, ' ').toUpperCase()}
                  </span>
                </div>
                <h3 className="card-headline m-0 min-w-0" style={{ color: textColor }}>
                  {card.title}
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
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="expanded-view-action-btn"
                    onClick={() => handleUnlike(card.id)}
                    aria-label="Unlike"
                    title="Remove from Likes"
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      border: 'none',
                      background: 'var(--color-pink)',
                      color: 'var(--color-yellow)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <svg width={28} height={28} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="expanded-view-action-btn"
                    onClick={() => handleActioned(card.id)}
                    aria-label={isActioned ? 'Unmark as actioned' : 'Mark as actioned'}
                    title={isActioned ? 'Unmark as actioned' : 'Mark as actioned (Truth Saving)'}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      border: isActioned ? '2px solid var(--color-purple)' : 'none',
                      background: isActioned ? 'var(--color-yellow)' : textColor,
                      color: isActioned ? 'var(--color-purple)' : bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </button>
                  {offerUrl && (
                    <a
                      href={offerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="expanded-view-action-btn"
                      aria-label="Open link"
                      title="Open link"
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        border: 'none',
                        background: textColor,
                        color: bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        textDecoration: 'none',
                      }}
                    >
                      <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </a>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
      <ZoneIntelligenceStrip variant="likes" dbConnected={dbConnected} dbHealthHint={dbHealthHint} />
    </motion.div>
  )
}
