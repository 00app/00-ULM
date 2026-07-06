'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp, readLocationStateFromStorage } from '@/app/context/AppContext'
import { runProfileResearchHandshake } from '@/lib/researchSyncClient'
import { buildResearchProfileFromStorage } from '@/lib/profile/buildResearchProfilePayload'
import { trackFunnelEvent } from '@/lib/analytics/trackFunnelEvent'
import { buildUserImpact } from '@/lib/brains/buildUserImpact'
import { syncFallbackGridIntensityGPerKwh } from '@/lib/brains/liveGridCarbonFactor'
import { normalizeEmploymentStatus } from '@/lib/brains/calculations'
import type { Persona } from '@/lib/brains/types'
import {
  buildSummaryStaccatoWords,
  isRealLocalityLabel,
  resolveImmediateSummaryCouncilLabel,
  type ProfileSummaryNarrativeInput,
  type SummaryLocalContext,
} from '@/lib/brains/summaryLogic'
import {
  persistProfileLocality,
  prefetchProfileLocalityForHandoff,
  readCachedProfileLocality,
} from '@/lib/geocode/resolvePostcodeLocality'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { ROUTES } from '@/lib/routes'
import { isStoredProfileOnboardingComplete } from '@/lib/profile/onboardingComplete'
import SummaryHeader from '@/app/components/SummaryHeader'
import { syncSessionState } from '@/lib/sessionStateSync'
import { INDUSTRIAL_OPACITY_SNAP, soloFocusSlamMotionProps } from '@/lib/animations'
import { AtomicLogo } from '@/app/components/Logo'
import { preloadAppFonts } from '@/lib/architecturalPulse'
import { SESSION_SUMMARY_TO_ZONE } from '@/lib/architecturalPulse'

const REDIRECT_NO_PROFILE_MS = 1800
const PAGE_EXIT_NAV_MS = 550
const LOCALITY_DISPLAY_SAFETY_MS = 2800
const EXIT_NAV_SAFETY_MS = 6000
const SUMMARY_SETTLE_MS = 1500
/** Wait for Neon `/api/summary` before starting ticker so £/CO₂ beats do not republish mid-cycle. */
const SUMMARY_GENOME_SETTLE_MS = 1200

const SESSION_ZONE_HANDOFF = SESSION_SUMMARY_TO_ZONE

function toSummaryLocalContext(local: SummaryLocalContext | null | undefined): SummaryLocalContext | null {
  if (!local?.council) return null
  return local
}

function readStoredSummaryLocalContext(): SummaryLocalContext | null {
  const stored = readLocationStateFromStorage()
  if (!stored?.local?.council) return null
  const l = stored.local
  return {
    council: l.council,
    region: l.region ?? l.council,
    localCarbonG: l.localCarbonG,
    ward: l.ward,
    locality: l.locality,
    outcode: l.outcode,
    country: l.country,
  }
}

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
  const [displayReady, setDisplayReady] = useState(false)
  const [fontsReady, setFontsReady] = useState(false)
  const [phase, setPhase] = useState<'cycle' | 'settle' | 'exit'>('cycle')
  const handshakePromiseRef = useRef<Promise<void> | null>(null)
  const exitNavTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const phaseRef = useRef(phase)
  const summaryPackRef = useRef(summaryPack)
  const displayReadyRef = useRef(displayReady)
  const zoneNavigatedRef = useRef(false)
  const lastLocationSyncRef = useRef('')
  const lastSummaryPublishRef = useRef('')
  const tickerLockedRef = useRef(false)
  const [tickerWords, setTickerWords] = useState<string[] | null>(null)
  phaseRef.current = phase
  summaryPackRef.current = summaryPack
  displayReadyRef.current = displayReady

  // Stable primitive key — not `state.profile` object identity (avoids summary effect loops).
  const profileEffectKey = useMemo(() => {
    const p = state.profile
    const stored = typeof window !== 'undefined' ? getProfileFromStorage() : null
    return [
      (p?.postcode ?? stored?.postcode ?? '').trim(),
      (p?.name ?? stored?.name ?? '').trim(),
      p?.livingSituation ?? stored?.livingSituation ?? '',
      p?.homeType ?? stored?.homeType ?? '',
      p?.transport ?? stored?.transport ?? '',
      p?.employmentStatus ?? '',
      p?.goal ?? stored?.goal ?? '',
      p?.age ?? stored?.age ?? '',
    ].join('\u001f')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- primitive fields below, not `state.profile` object
  }, [
    state.profile?.postcode,
    state.profile?.name,
    state.profile?.livingSituation,
    state.profile?.homeType,
    state.profile?.transport,
    state.profile?.employmentStatus,
    state.profile?.goal,
    state.profile?.age,
  ])

  const navigateToZone = useCallback(() => {
    if (zoneNavigatedRef.current) return
    const pack = summaryPackRef.current
    if (!pack) return
    zoneNavigatedRef.current = true
    setHeroTotals({
      totalMoney: Math.max(0, Math.round(pack.waste.totalsMoney)),
      totalCarbon: Math.max(0, Math.round(pack.waste.totalsCarbon)),
    })
    syncSessionState()
    try {
      sessionStorage.setItem(SESSION_ZONE_HANDOFF, '1')
    } catch {
      //
    }
    trackFunnelEvent('summary_enter_zone')
    router.push(ROUTES.ZONE)
  }, [router, setHeroTotals])

  useLayoutEffect(() => setMounted(true), [])

  // Absolute backstop — deliberately independent of the data-fetching effect below (which
  // depends on profileEffectKey and can legitimately re-run mid-flight, e.g. a locationState
  // update triggering a fresh profileEffectKey, cancelling its own in-progress hard safety timer
  // before it ever fires). If that keeps happening, the "hard safety timer" inside that effect
  // never actually gets a chance to run, and the user is stuck indefinitely with no fallback ever
  // firing — this effect cannot be cancelled by that churn since it only depends on `mounted`.
  useEffect(() => {
    if (!mounted) return
    const id = window.setTimeout(() => {
      if (displayReadyRef.current) return
      console.warn('[summary] absolute backstop fired — main effect never settled, publishing zero-value fallback')
      setSummaryPack({
        waste: { annualWasteCash: 0, annualWasteCarbon: 0, totalsMoney: 0, totalsCarbon: 0 },
        narrative: {
          employment_status: undefined,
          displayName: state.profile?.name || undefined,
          councilLabel: 'the UK',
          postcodeDisplay: (state.profile?.postcode ?? '').trim(),
          local: null,
          totalsMoney: 0,
          totalsCarbon: 0,
          annualWasteCash: 0,
          annualWasteCarbon: 0,
        },
      })
      setDisplayReady(true)
    }, 12000)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately mount-only, see comment above
  }, [mounted])

  useEffect(() => {
    let cancelled = false
    const timeout = window.setTimeout(() => {
      if (!cancelled) setFontsReady(true)
    }, 2000)
    void preloadAppFonts().then(() => {
      if (!cancelled) setFontsReady(true)
    })
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [])

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    lastLocationSyncRef.current = ''
    lastSummaryPublishRef.current = ''

    // Outer guard — everything below (localStorage reads, JSON parsing) runs before the hard
    // safety timer gets armed. On Safari (private browsing / storage-partitioning edge cases),
    // a raw localStorage.getItem() call can throw synchronously where Chrome wouldn't — if that
    // happens here, the whole effect used to die before the safety net ever existed, leaving the
    // user stuck on the loading logo with no fallback at all. This outer try/catch is the actual
    // safety net for that case; the 9s timer below only helps once we get this far.
    let cancelled = false
    let hardSafetyTimer: number | undefined
    let safetyTimer: number | undefined
    try {
      const profileFromContext = state.profile
      const fromStorage = getProfileFromStorage()
      // readProfileFromStorage() (AppContext) can return a non-null profile with an empty
      // name/postcode when only some onboarding fields have landed yet — `??` treats that
      // empty string as "defined" and never falls through to the (correct) storage read here.
      // Use `||` so an empty string is treated the same as missing.
      const profilePostcode = (profileFromContext?.postcode?.trim() || fromStorage?.postcode?.trim() || '')
      const profileName = (profileFromContext?.name?.trim() || fromStorage?.name?.trim() || '')

      if (!profilePostcode && !profileName) return

    const postcode = (profilePostcode ?? '').replace(/\s+/g, '').trim().toUpperCase()

    const profile = {
      name: profileName || undefined,
      postcode: profilePostcode || undefined,
      household: profileFromContext?.livingSituation ?? fromStorage?.livingSituation ?? undefined,
      home_type: profileFromContext?.homeType ?? fromStorage?.homeType ?? undefined,
      transport_baseline: profileFromContext?.transport ?? fromStorage?.transport ?? undefined,
      goal: profileFromContext?.goal || fromStorage?.goal || undefined,
      age:
        profileFromContext?.age && ['JUNIOR', 'MID', 'RETIRED'].includes(profileFromContext.age)
          ? (profileFromContext.age as Persona)
          : fromStorage?.age && ['JUNIOR', 'MID', 'RETIRED'].includes(fromStorage.age)
            ? (fromStorage.age as Persona)
            : undefined,
      employment_status: normalizeEmploymentStatus(
        profileFromContext?.employmentStatus ??
          (typeof window !== 'undefined'
            ? localStorage.getItem('profile_employment_status') ?? undefined
            : undefined)
      ),
    }

    const journeyAnswers = loadJourneyAnswers()

    const postcodeDisplay = (profile.postcode ?? '').trim()

    const storedLocation = readLocationStateFromStorage()
    const storedLocal = readStoredSummaryLocalContext()
    const contextLocal =
      toSummaryLocalContext(
        state.locationState?.local
          ? {
              council: state.locationState.local.council,
              region: state.locationState.local.region ?? state.locationState.local.council,
              localCarbonG: state.locationState.local.localCarbonG,
              ward: state.locationState.local.ward,
              locality: state.locationState.local.locality,
              outcode: state.locationState.local.outcode,
              country: state.locationState.local.country,
            }
          : null
      ) ?? storedLocal

    const cachedLocality = postcode.length >= 4 ? readCachedProfileLocality(postcode) : null
    const locationFromContext =
      state.locationState?.locationName?.trim() ?? storedLocation?.locationName?.trim() ?? ''

    const buildPack = (
      local: SummaryLocalContext | null,
      resolvedLocationName: string,
      money: number,
      carbon: number,
      profileWaste: { annualWasteCash: number; annualWasteCarbon: number },
      genomeMoney?: number
    ) => {
      const modelledCash = money > 0 ? money : profileWaste.annualWasteCash
      const modelledCarbon = carbon > 0 ? carbon : profileWaste.annualWasteCarbon
      const wastePack = {
        annualWasteCash: Math.round(modelledCash),
        annualWasteCarbon: Math.round(modelledCarbon),
        totalsMoney: Math.round(money),
        totalsCarbon: Math.round(carbon),
      }
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
        genomeSavingsMoney: genomeMoney,
      }
      return { waste: wastePack, narrative }
    }

    const publishSummary = (
      local: SummaryLocalContext | null,
      resolvedLocationName: string,
      money: number,
      carbon: number,
      profileWaste: { annualWasteCash: number; annualWasteCarbon: number },
      genomeMoney?: number
    ) => {
      // Deliberately NOT gated on tickerLockedRef: that flag only stops the ticker's words
      // from being rebuilt mid-animation (see the effect below). If a provisional publish
      // (e.g. the LOCALITY_DISPLAY_SAFETY_MS fallback) already locked the ticker before the
      // real locality/genome result resolved, that real result must still update summaryPack
      // and locationState — navigateToZone() seeds Zone's hero totals/locality straight from
      // them, so silently dropping a late-arriving correction here means Zone starts from
      // stale fallback data too.
      if (cancelled) return
      const publishKey = [
        resolvedLocationName,
        local?.council ?? '',
        String(local?.localCarbonG ?? ''),
        String(money),
        String(carbon),
        String(profileWaste.annualWasteCash),
        String(profileWaste.annualWasteCarbon),
        String(genomeMoney ?? ''),
      ].join('|')
      if (lastSummaryPublishRef.current === publishKey) return
      lastSummaryPublishRef.current = publishKey

      if (resolvedLocationName && postcode.length >= 4 && isRealLocalityLabel(resolvedLocationName)) {
        persistProfileLocality(postcode, resolvedLocationName)
      }
      setSummaryPack(buildPack(local, resolvedLocationName, money, carbon, profileWaste, genomeMoney))
      setDisplayReady(true)
      if (isRealLocalityLabel(resolvedLocationName)) {
        const locationKey = [
          resolvedLocationName,
          local?.council ?? '',
          String(local?.localCarbonG ?? ''),
        ].join('|')
        if (lastLocationSyncRef.current !== locationKey) {
          lastLocationSyncRef.current = locationKey
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
      }
    }

    // Hard safety net — if literally anything below throws or hangs (a malformed journey-answer
    // blob from months of accumulated localStorage, an edge case in buildUserImpact, a stalled
    // fetch), the user must never be stuck on the loading logo forever. This fires unconditionally
    // after a few seconds unless a real publish has already happened.
    hardSafetyTimer = window.setTimeout(() => {
      if (cancelled || displayReadyRef.current) return
      console.warn('[summary] hard safety timeout — publishing zero-value fallback')
      setSummaryPack({
        waste: { annualWasteCash: 0, annualWasteCarbon: 0, totalsMoney: 0, totalsCarbon: 0 },
        narrative: {
          employment_status: undefined,
          displayName: profile.name || undefined,
          councilLabel: 'the UK',
          postcodeDisplay,
          local: null,
          totalsMoney: 0,
          totalsCarbon: 0,
          annualWasteCash: 0,
          annualWasteCarbon: 0,
        },
      })
      setDisplayReady(true)
    }, 9000)

    try {
      const gridIntensityGPerKwh =
        typeof contextLocal?.localCarbonG === 'number' && contextLocal.localCarbonG > 0
          ? contextLocal.localCarbonG
          : syncFallbackGridIntensityGPerKwh(postcode)

      const impact = buildUserImpact(
        { profile, journeyAnswers },
        { gridIntensityGPerKwh }
      )

      let totalsMoney = impact.totals.totalMoney
      let totalsCarbon = impact.totals.totalCarbon
      let genomeSavingsMoney: number | undefined

      const councilImmediate = resolveImmediateSummaryCouncilLabel({
        postcodeDisplay,
        cachedLocality,
        locationName: locationFromContext,
        local: contextLocal,
      })
      const hasRealLocality = isRealLocalityLabel(councilImmediate)

      if (postcode.length < 4) {
        publishSummary(contextLocal, 'the UK', totalsMoney, totalsCarbon, impact.summaryWaste)
      } else if (!hasRealLocality) {
        safetyTimer = window.setTimeout(() => {
          if (cancelled || displayReadyRef.current) return
          const outward = postcode.replace(/\s+/g, '').toUpperCase().match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/)?.[1]
          const fallback = outward && outward.length >= 2 ? outward : 'the UK'
          publishSummary(contextLocal, fallback, totalsMoney, totalsCarbon, impact.summaryWaste)
        }, LOCALITY_DISPLAY_SAFETY_MS)
      }

      ;(async () => {
        try {
          let local: SummaryLocalContext | null = contextLocal
          let resolvedLocationName = hasRealLocality ? councilImmediate : ''

          if (postcode.length >= 4 && !hasRealLocality) {
            const handoff = await prefetchProfileLocalityForHandoff(postcode)
            if (handoff?.local) {
              local = {
                council: handoff.local.council,
                region: handoff.local.region ?? handoff.local.council,
                localCarbonG: handoff.local.localCarbonG,
                ward: handoff.local.ward,
                locality: handoff.local.locality,
                outcode: handoff.local.outcode,
                country: handoff.local.country,
              }
            }
            if (handoff?.label?.trim() && isRealLocalityLabel(handoff.label)) {
              resolvedLocationName = handoff.label.trim()
            }
          }

          if (!isRealLocalityLabel(resolvedLocationName)) {
            resolvedLocationName =
              resolveImmediateSummaryCouncilLabel({
                postcodeDisplay,
                cachedLocality: readCachedProfileLocality(postcode),
                locationName: locationFromContext,
                local,
              }) || ''
          }

          if (cancelled) return
          if (safetyTimer != null) window.clearTimeout(safetyTimer)

          const displayLabel = isRealLocalityLabel(resolvedLocationName)
            ? resolvedLocationName
            : isRealLocalityLabel(councilImmediate)
              ? councilImmediate
              : 'the UK'

          let summaryBody: {
            savings?: number
            carbon?: number
            genomeTotals?: { totalMoney?: number; totalCarbon?: number }
          } | null = null
          try {
            const summaryRes = await Promise.race([
              fetch('/api/summary?type=profile', { credentials: 'include', cache: 'no-store' }).then((sr) =>
                sr.ok ? sr.json() : null
              ),
              new Promise<null>((resolve) => window.setTimeout(() => resolve(null), SUMMARY_GENOME_SETTLE_MS)),
            ])
            summaryBody = summaryRes
          } catch {
            summaryBody = null
          }

          if (cancelled) return

          if (summaryBody) {
            const gMoney = summaryBody.genomeTotals?.totalMoney ?? summaryBody.savings
            const gCarbon = summaryBody.genomeTotals?.totalCarbon ?? summaryBody.carbon
            if (typeof gMoney === 'number' && gMoney > 0) genomeSavingsMoney = Math.round(gMoney)
            if (typeof gMoney === 'number' && gMoney > 0) totalsMoney = gMoney
            if (typeof gCarbon === 'number' && gCarbon > 0) totalsCarbon = gCarbon
          }

          publishSummary(local, displayLabel, totalsMoney, totalsCarbon, impact.summaryWaste, genomeSavingsMoney)
        } catch (err) {
          console.warn('[summary] async resolution failed, falling back:', err)
          if (!cancelled) publishSummary(contextLocal, 'the UK', totalsMoney, totalsCarbon, impact.summaryWaste)
        }
      })()
    } catch (err) {
      console.warn('[summary] sync computation failed, falling back:', err)
      if (!cancelled) {
        publishSummary(contextLocal, 'the UK', 0, 0, { annualWasteCash: 0, annualWasteCarbon: 0 })
      }
    }
    } catch (setupErr) {
      // Anything above (localStorage reads, JSON parsing) threw before the hard safety timer
      // even existed — publish immediately rather than leaving the user on the loading logo.
      console.warn('[summary] pre-processing crashed, publishing immediate zero-value fallback:', setupErr)
      if (!cancelled && !displayReadyRef.current) {
        setSummaryPack({
          waste: { annualWasteCash: 0, annualWasteCarbon: 0, totalsMoney: 0, totalsCarbon: 0 },
          narrative: {
            employment_status: undefined,
            displayName: state.profile?.name || undefined,
            councilLabel: 'the UK',
            postcodeDisplay: (state.profile?.postcode ?? '').trim(),
            local: null,
            totalsMoney: 0,
            totalsCarbon: 0,
            annualWasteCash: 0,
            annualWasteCarbon: 0,
          },
        })
        setDisplayReady(true)
      }
    }

    return () => {
      cancelled = true
      if (hardSafetyTimer != null) window.clearTimeout(hardSafetyTimer)
      if (safetyTimer != null) window.clearTimeout(safetyTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- omit locationState; publishSummary writes it and would loop
  }, [mounted, profileEffectKey, setLocationState])

  useEffect(() => {
    if (!mounted) return
    const hasProfile = getProfileFromStorage() ?? state.profile
    if (hasProfile) return
    if (isStoredProfileOnboardingComplete()) return
    const t = setTimeout(() => {
      // Re-check at fire time, not just at effect-setup time — localStorage/state.profile may
      // have populated in the interim (hard navigation from /profile can lag a few ms behind
      // this effect's first run), and a stale check here would bounce a complete profile back.
      const stillNoProfile = !(getProfileFromStorage() ?? state.profile)
      if (stillNoProfile && !isStoredProfileOnboardingComplete()) {
        router.replace(ROUTES.PROFILE)
      }
    }, REDIRECT_NO_PROFILE_MS)
    return () => clearTimeout(t)
  }, [mounted, state.profile, router])

  useEffect(() => {
    if (!displayReady || !summaryPack || tickerWords) return
    tickerLockedRef.current = true
    setTickerWords(buildSummaryStaccatoWords(summaryPack.narrative))
  }, [displayReady, summaryPack, tickerWords])

  useEffect(() => {
    if (phase !== 'exit' || !summaryPackRef.current) return
    if (exitNavTimeoutRef.current != null) return
    exitNavTimeoutRef.current = setTimeout(() => {
      exitNavTimeoutRef.current = null
      navigateToZone()
    }, PAGE_EXIT_NAV_MS)
    return () => {
      if (exitNavTimeoutRef.current != null) {
        clearTimeout(exitNavTimeoutRef.current)
        exitNavTimeoutRef.current = null
      }
    }
  }, [phase, navigateToZone])

  useEffect(() => {
    if (phase !== 'exit') return
    const safety = window.setTimeout(() => {
      if (phaseRef.current === 'exit') navigateToZone()
    }, EXIT_NAV_SAFETY_MS)
    return () => window.clearTimeout(safety)
  }, [phase, navigateToZone])

  /** Zone research handshake — deferred until summary exit so the ticker stays fast. */
  useEffect(() => {
    if (phase !== 'exit') return
    const pc = String(state.profile?.postcode ?? localStorage.getItem('profile_postcode') ?? '')
      .replace(/\s+/g, '')
      .trim()
      .toUpperCase()
    if (pc.length < 4) return

    const profileData = buildResearchProfileFromStorage({ postcode: pc })
    const handshakeAbort = new AbortController()
    const handshakeAbortTimer = window.setTimeout(() => handshakeAbort.abort(), 8000)
    handshakePromiseRef.current = (async () => {
      try {
        await runProfileResearchHandshake({
          postcode: pc,
          profileData,
          signal: handshakeAbort.signal,
        })
      } finally {
        window.clearTimeout(handshakeAbortTimer)
      }
    })()
  }, [phase, state.profile?.postcode])

  const handleCycleComplete = () => {
    setPhase('settle')
    setTimeout(() => {
      setPhase('exit')
    }, SUMMARY_SETTLE_MS)
  }

  if (!summaryPack || !displayReady || !tickerWords?.length) {
    return (
      <motion.div
        className="zz-profile-page summary-page--minimal mode-ui"
        style={{
          height: '100dvh',
          maxHeight: '100dvh',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
        aria-busy="true"
        aria-label="Preparing profile summary"
      >
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AtomicLogo loop width={100} />
        </div>
      </motion.div>
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
        padding: 'max(40px, env(safe-area-inset-top, 0px)) 40px max(40px, env(safe-area-inset-bottom, 0px)) 40px',
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
                  key={tickerWords.join('\u001f')}
                  words={tickerWords}
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
