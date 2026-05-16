'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '@/app/context/AppContext'
import { buildUserImpact } from '@/lib/brains/buildUserImpact'
import { BASELINE_2026_CAP_GBP } from '@/lib/brains/calculations'
import { normalizeEmploymentStatus } from '@/lib/brains/calculations'
import type { Persona } from '@/lib/brains/types'
import {
  buildSummaryStaccatoWords,
  type ProfileSummaryNarrativeInput,
  type SummaryLocalContext,
} from '@/lib/brains/summaryLogic'
import { formatLocationDisplayName } from '@/lib/locationIdentity'
import {
  formatPostcodeFallback,
  readCachedProfileLocality,
  resolveProfileLocalityForPostcode,
} from '@/lib/geocode/resolvePostcodeLocality'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { ROUTES } from '@/lib/routes'
import SummaryHeader from '@/app/components/SummaryHeader'
import { syncSessionState } from '@/lib/sessionStateSync'
import { INDUSTRIAL_OPACITY_SNAP, soloFocusSlamMotionProps } from '@/lib/animations'

const REDIRECT_NO_PROFILE_MS = 1800
/** Slack shown in kinetic + reveal: see `lib/brains/summaryLogic.ts` (same cord as Zone — `buildUserImpact`). */
const WASTE_FACTOR = 0.22
const PAGE_EXIT_NAV_MS = 800
const SESSION_ZONE_HANDOFF = 'zz_summary_to_zone'

function getProfileFromStorage() {
  if (typeof window === 'undefined') return null
  const name = localStorage.getItem('profile_name') ?? ''
  const postcode = localStorage.getItem('profile_postcode') ?? ''
  const household = localStorage.getItem('profile_household') ?? ''
  const homeType = localStorage.getItem('profile_home_type') ?? ''
  const transport = localStorage.getItem('profile_transport') ?? ''
  const age = localStorage.getItem('profile_age') ?? ''
  const goal = localStorage.getItem('profile_goal') ?? ''
  if (!postcode && !name) return null
  return { name, postcode, livingSituation: household, homeType, transport, age: age || undefined, goal: goal || undefined }
}

function loadJourneyAnswers(): Record<JourneyId, Record<string, string>> {
  const out = {} as Record<JourneyId, Record<string, string>>
  if (typeof window === 'undefined') return out
  JOURNEY_ORDER.forEach((jid) => {
    try {
      const raw = localStorage.getItem(`journey_${jid}_answers`)
      out[jid] = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    } catch {
      out[jid] = {}
    }
  })
  return out
}

type SummaryPack = {
  waste: {
    annualWasteCash: number
    annualWasteCarbon: number
    totalsMoney: number
    totalsCarbon: number
  }
  narrative: ProfileSummaryNarrativeInput
}

export default function ProfileSummaryPage() {
  const router = useRouter()
  const { state, setHeroTotals, setLocationState, refreshProfile } = useApp()
  const [mounted, setMounted] = useState(false)
  const [summaryPack, setSummaryPack] = useState<SummaryPack | null>(null)
  const [phase, setPhase] = useState<'cycle' | 'settle' | 'exit'>('cycle')
  const handshakePromiseRef = useRef<Promise<void> | null>(null)
  const exitNavTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    const profileFromContext = state.profile
    const profile = profileFromContext?.postcode
      ? {
          name: profileFromContext.name,
          postcode: profileFromContext.postcode,
          household: profileFromContext.livingSituation,
          home_type: profileFromContext.homeType,
          transport_baseline: profileFromContext.transport,
          goal: profileFromContext.goal || undefined,
          age: profileFromContext.age && ['JUNIOR', 'MID', 'RETIRED'].includes(profileFromContext.age)
            ? (profileFromContext.age as Persona)
            : undefined,
          employment_status: normalizeEmploymentStatus(profileFromContext.employmentStatus),
        }
      : getProfileFromStorage()
        ? {
            name: localStorage.getItem('profile_name') ?? undefined,
            postcode: localStorage.getItem('profile_postcode') ?? undefined,
            household: localStorage.getItem('profile_household') ?? undefined,
            home_type: localStorage.getItem('profile_home_type') ?? undefined,
            transport_baseline: localStorage.getItem('profile_transport') ?? undefined,
            goal: localStorage.getItem('profile_goal') ?? undefined,
            age: (() => {
              const a = localStorage.getItem('profile_age') ?? ''
              return ['JUNIOR', 'MID', 'RETIRED'].includes(a) ? (a as Persona) : undefined
            })(),
            employment_status: normalizeEmploymentStatus(
              localStorage.getItem('profile_employment_status') ?? undefined
            ),
          }
        : null

    if (!profile) return

    let cancelled = false
    const journeyAnswers = loadJourneyAnswers()
    const impact = buildUserImpact({ profile, journeyAnswers })

    const postcode = (profile.postcode ?? '').replace(/\s+/g, '').trim().toUpperCase()
    const postcodeDisplay = (profile.postcode ?? '').trim()
    const postcodeFallback = formatPostcodeFallback(postcodeDisplay || postcode)

    let totalsMoney = impact.totals.totalMoney
    let totalsCarbon = impact.totals.totalCarbon
    let genomeSavingsMoney: number | undefined

    const locationFromContext = state.locationState?.locationName?.trim() ?? ''
    const cachedLocality = postcode.length >= 4 ? readCachedProfileLocality(postcode) : null
    const councilImmediate = cachedLocality || locationFromContext || postcodeFallback || 'the UK'

    ;(async () => {
      let local: SummaryLocalContext | null = null
      let geocodedLocality = cachedLocality
      if (postcode.length >= 4) {
        const localityPromise = resolveProfileLocalityForPostcode(postcode)
        try {
          const ac = new AbortController()
          const tid = setTimeout(() => ac.abort(), 3200)
          const r = await fetch('/api/local-intelligence', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postcode }),
            signal: ac.signal,
          })
          clearTimeout(tid)
          if (r.ok) {
            const d = await r.json().catch(() => null)
            if (d && typeof d.council === 'string') {
              local = {
                council: d.council,
                region: typeof d.region === 'string' ? d.region : undefined,
                localCarbonG: typeof d.localCarbonG === 'number' ? d.localCarbonG : undefined,
                ward: typeof d.ward === 'string' ? d.ward : undefined,
                locality: typeof d.locality === 'string' ? d.locality : undefined,
                outcode: typeof d.outcode === 'string' ? d.outcode : undefined,
                country: typeof d.country === 'string' ? d.country : undefined,
              }
            }
          }
        } catch {
          // offline / abort — still show summary with defaults
        }

        try {
          const locality = await localityPromise
          if (locality.label) geocodedLocality = locality.label
        } catch {
          /* Nominatim / API — keep postcode fallback */
        }
      }

      if (cancelled) return

      try {
        const sr = await fetch('/api/summary?type=profile', { credentials: 'include', cache: 'no-store' })
        if (sr.ok) {
          const body = (await sr.json()) as {
            savings?: number
            carbon?: number
            genomeTotals?: { totalMoney?: number; totalCarbon?: number }
          }
          const gMoney = body.genomeTotals?.totalMoney ?? body.savings
          const gCarbon = body.genomeTotals?.totalCarbon ?? body.carbon
          if (typeof gMoney === 'number' && gMoney > 0) genomeSavingsMoney = Math.round(gMoney)
          if (typeof gMoney === 'number' && gMoney > 0) totalsMoney = gMoney
          if (typeof gCarbon === 'number' && gCarbon > 0) totalsCarbon = gCarbon
        }
      } catch {
        /* guest / offline — keep buildUserImpact totals */
      }

      const annualSpendLikeYou = Math.max(BASELINE_2026_CAP_GBP, totalsMoney)
      const wastePack = {
        annualWasteCash: Math.round(annualSpendLikeYou * WASTE_FACTOR),
        annualWasteCarbon: Math.round(totalsCarbon * WASTE_FACTOR),
        totalsMoney,
        totalsCarbon,
      }

      const locationFromPostcodesIo = formatLocationDisplayName(
        local
          ? {
              council: local.council,
              region: local.region ?? local.council,
              localCarbonG: local.localCarbonG,
              ward: local.ward,
              locality: local.locality,
              outcode: local.outcode,
              country: local.country,
            }
          : null,
        null
      )
      const resolvedLocationName =
        geocodedLocality?.trim() ||
        locationFromPostcodesIo.trim() ||
        state.locationState?.locationName?.trim() ||
        councilImmediate

      const narrative: ProfileSummaryNarrativeInput = {
        employment_status: profile.employment_status,
        displayName: (profile.name ?? '').trim() || undefined,
        councilLabel: resolvedLocationName,
        postcodeDisplay,
        local,
        totalsMoney: wastePack.totalsMoney,
        totalsCarbon: wastePack.totalsCarbon,
        annualWasteCash: wastePack.annualWasteCash,
        annualWasteCarbon: wastePack.annualWasteCarbon,
        genomeSavingsMoney,
      }

      setSummaryPack({
        waste: wastePack,
        narrative,
      })
      if (resolvedLocationName && resolvedLocationName !== 'the UK') {
        setLocationState({
          locationName: resolvedLocationName,
          local: local
            ? {
                council: local.council,
                region: local.region ?? local.council,
                localCarbonG: local.localCarbonG,
                ward: local.ward,
                locality: local.locality,
                outcode: local.outcode,
                country: local.country,
              }
            : null,
        })
      }

      if (postcode.length >= 4) {
        handshakePromiseRef.current = (async () => {
          const [scrapeRes, tipsRefreshRes] = await Promise.allSettled([
            fetch('/api/scrape-sync', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                trigger: true,
                postcode,
                profileData: {
                  home_type: profile.home_type ?? undefined,
                  transport_baseline: profile.transport_baseline ?? undefined,
                  household: profile.household ?? undefined,
                  goal: profile.goal ?? undefined,
                },
              }),
            }),
            fetch('/api/zone/tips-refresh', { method: 'POST', credentials: 'include' }),
          ])
          if (scrapeRes.status === 'fulfilled' && scrapeRes.value.ok) {
            await scrapeRes.value.json().catch(() => null)
          }
          if (tipsRefreshRes.status === 'fulfilled' && tipsRefreshRes.value.ok) {
            await tipsRefreshRes.value.json().catch(() => null)
          }
        })()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [mounted, state.profile, state.locationState?.locationName, setLocationState])

  useEffect(() => {
    if (!mounted) return
    const hasProfile = getProfileFromStorage() ?? state.profile
    if (hasProfile) return
    const t = setTimeout(() => router.replace(ROUTES.PROFILE), REDIRECT_NO_PROFILE_MS)
    return () => clearTimeout(t)
  }, [mounted, state.profile, router])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      JOURNEY_ORDER.forEach((jid) => {
        localStorage.removeItem(`journey_${jid}_answers`)
      })
      refreshProfile()
    }
  }, [refreshProfile])

  const staccatoWords = useMemo(
    () => (summaryPack ? buildSummaryStaccatoWords(summaryPack.narrative) : []),
    [summaryPack]
  )

  useEffect(() => {
    if (phase !== 'exit' || !summaryPack) return
    if (exitNavTimeoutRef.current != null) return
    exitNavTimeoutRef.current = setTimeout(async () => {
      exitNavTimeoutRef.current = null
      try {
        await (handshakePromiseRef.current ?? Promise.resolve())
      } finally {
        setHeroTotals({
          totalMoney: Math.max(0, Math.round(summaryPack.waste.totalsMoney)),
          totalCarbon: Math.max(0, Math.round(summaryPack.waste.totalsCarbon)),
        })
        syncSessionState()
        try {
          sessionStorage.setItem(SESSION_ZONE_HANDOFF, '1')
        } catch {
          //
        }
        router.push(ROUTES.ZONE)
      }
    }, PAGE_EXIT_NAV_MS)
    return () => {
      if (exitNavTimeoutRef.current != null) {
        clearTimeout(exitNavTimeoutRef.current)
        exitNavTimeoutRef.current = null
      }
    }
  }, [phase, summaryPack, router, setHeroTotals])

  const handleCycleComplete = () => {
    setPhase('settle')
    setTimeout(() => {
      setPhase('exit')
    }, 1500)
  }

  if (!summaryPack) {
    return (
      <div
        className="zz-profile-page summary-page--minimal mode-ui"
        style={{
          height: '100dvh',
          maxHeight: '100dvh',
          overflow: 'hidden',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
        aria-busy="true"
        aria-label="Preparing profile summary"
      />
    )
  }

  return (
    <motion.div
      className="zz-profile-page summary-page--minimal mode-ui"
      style={{
        height: '100dvh',
        maxHeight: '100dvh',
        minHeight: 0,
        color: 'var(--color-yellow)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        transformOrigin: 'center center',
      }}
      initial={false}
      animate={
        phase === 'exit'
          ? { opacity: 0, y: 2 }
          : { opacity: 1, y: 0 }
      }
      transition={INDUSTRIAL_OPACITY_SNAP}
    >
      <div
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 720,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'min(72vh, 520px)',
        }}
      >
        <>
          {(phase === 'cycle' || phase === 'settle') && (
            <motion.div
              key="summary-cycle"
              {...soloFocusSlamMotionProps(false, false)}
              style={{
                position: 'relative',
                width: '100%',
                minHeight: 140,
                transformOrigin: 'center center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: 40,
                background: 'transparent',
              }}
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={INDUSTRIAL_OPACITY_SNAP}
              exit={{
                opacity: 0,
                y: 2,
                transition: INDUSTRIAL_OPACITY_SNAP,
              }}
            >
              <div style={{ position: 'relative', width: '100%', minHeight: 120 }}>
                <SummaryHeader
                  words={staccatoWords}
                  pulseGenomeMoney={(summaryPack?.narrative?.genomeSavingsMoney ?? 0) > 0}
                  onComplete={handleCycleComplete}
                />
              </div>
            </motion.div>
          )}
        </>
      </div>
    </motion.div>
  )
}
