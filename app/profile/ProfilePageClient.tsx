'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import { firstNameFromAutofill } from '@/lib/profile/firstNameFromInput'
import { trackFunnelEvent } from '@/lib/analytics/trackFunnelEvent'
import { useApp } from '@/app/context/AppContext'
import ProfileAnswerBtn from '@/app/components/ui/ProfileAnswerBtn'
import {
  familyAtomicProps,
  familyControlDelaySec,
  familyProfileStepProps,
  FAMILY_TRANSITION_ATOMIC,
} from '@/lib/motion-family'
import InputField from '@/app/components/InputField'
import { createUser } from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { persistUnifiedUserProfileMemory } from '@/lib/unifiedProfileMemory'
import type { ProfileAge } from '@/app/context/AppContext'
import { formatLocationDisplayName } from '@/lib/locationIdentity'
import { isRealLocalityLabel } from '@/lib/brains/summaryLogic'
import {
  persistProfileLocality,
  prefetchProfileLocalityForHandoff,
  readCachedProfileLocality,
} from '@/lib/geocode/resolvePostcodeLocality'
import { checkUkPostcode, isValidUkPostcode } from '@/lib/geocode/ukPostcode'
import {
  guestProfileOnboardingComplete,
  isProfileOnboardingCompleteFields,
  PROFILE_GOAL_STORAGE_KEY,
  PROFILE_STORAGE_KEYS,
  readStoredProfileGoal,
  userRowOnboardingComplete,
  type ProfileOnboardingFields,
} from '@/lib/profile/onboardingComplete'
import type { LocalIntelligence } from '@/lib/local/getLocalData'
import { clearZoneVmLocalCache } from '@/lib/zone/clearZoneVmCache'
import { PROFILE_ENTRY_CHOICE_KEY, PROFILE_STEP_KEY } from '@/lib/dataVersion'
import { persistSessionRestoreProof } from '@/lib/client/sessionRestoreProofStorage'
import { persistHomePowerFromProfile } from '@/lib/profile/homePower'
import { syncSessionState } from '@/lib/sessionStateSync'
import { browserCanTriggerScrapeSync, triggerOnboardingResearchBootstrap, triggerScrapeSyncForCategory } from '@/lib/researchSyncClient'
import { buildResearchProfilePayload } from '@/lib/profile/buildResearchProfilePayload'
import { applyPropertyPrefillFromApiResponse } from '@/lib/client/propertyAnswerSourcesStorage'
import { mapEpcPropertyTypeToHomeTypeHint } from '@/lib/epc/mapEpcToProfileHints'
import { flushSync } from 'react-dom'
import { INTRO_GOAL_QUESTION, PROFILE_GOAL_CHOICES, type ProfileGoalValue } from '@/lib/profile/goalWeighting'

/** Software-keyboard lift — phones only; tablet (768+) and desktop stay centred. */
const PROFILE_MOBILE_KEYBOARD_MQ = '(max-width: 767px)'

function isProfileMobileKeyboardViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(PROFILE_MOBILE_KEYBOARD_MQ).matches
}

type ProfileQuestion = {
  id: string
  label: string
  type: 'input' | 'options'
  placeholder?: string
  options?: unknown[]
  getInsight?: (value: string, locality: string) => string | null
}

const PROFILE_QUESTIONS: ProfileQuestion[] = [
  { id: 'postcode', label: 'where do you live?', type: 'input' as const, placeholder: 'postcode',
    getInsight: (_v, locality) => locality ? `${locality}.\nwe've pulled local data.` : null },
  {
    id: 'livingSituation',
    label: 'who do you live with?',
    type: 'options' as const,
    options: ['ALONE', 'COUPLE', 'FAMILY', 'SHARED'],
  },
  { id: 'homeType', label: 'your home?', type: 'options' as const, options: ['FLAT', 'HOUSE'],
    getInsight: (v) =>
      v === 'HOUSE' ? 'houses have more room to save —\nroof, loft, and garden all help.' :
      v === 'FLAT' ? 'flats still add up —\nwe\'ll focus on what\'s in your control.' : null },
  {
    id: 'homeOwnership',
    label: 'do you own or rent?',
    type: 'options' as const,
    options: ['OWNER', 'RENTER'],
  },
  {
    id: 'powerType',
    label: 'how do you heat your home?',
    type: 'options' as const,
    options: [
      'GAS',
      'ELECTRIC',
      { label: 'MIXED', value: 'MIX', ariaLabel: 'Mixed — gas and electric' },
      'OTHER',
    ],
    getInsight: (v, locality) =>
      v === 'GAS' ? `${locality || 'your area'} gas homes pay\n£180 more yearly.` :
      v === 'ELECTRIC' ? 'fully electric. you\'re already ahead\nof most households.' :
      v === 'MIX' ? 'mixed. there\'s room to optimise\nboth sides.' : null,
  },
  {
    id: 'transport',
    label: 'how do you get around?',
    type: 'options' as const,
    options: ['WALK', 'BIKE', 'PUBLIC', 'CAR', 'MIX'],
    getInsight: (v) =>
      v === 'CAR' ? 'drivers here spend £2,100\na year on fuel.' :
      v === 'PUBLIC' ? 'public transport keeps your carbon\nlower than most.' :
      v === 'WALK' || v === 'BIKE' ? 'no fuel spend. that\'s a real\nadvantage.' : null,
  },
  {
    id: 'washPreference',
    label: 'bath or shower,\nmostly?',
    type: 'options' as const,
    options: ['SHOWER', 'BATH', 'BOTH'],
    getInsight: (v) =>
      v === 'BATH' ? 'baths use more hot water —\nreal room to save.' :
      v === 'SHOWER' ? 'showers already keep your\nwater bill lean.' : null,
  },
  {
    id: 'flightFrequency',
    label: 'how many flights\na year, roughly?',
    type: 'options' as const,
    options: [
      'NONE',
      { label: 'ONE OR\nTWO', value: 'ONE_TWO', ariaLabel: 'One or two' },
      { label: 'THREE+', value: 'THREE_PLUS', ariaLabel: 'Three or more' },
    ],
    getInsight: (v) =>
      v === 'THREE_PLUS' ? 'frequent flying is the biggest\nlever on this page.' :
      v === 'NONE' ? 'no flights. your holiday footprint\nis already low.' : null,
  },
  {
    id: 'age',
    label: 'stage in life?',
    type: 'options' as const,
    options: [
      { label: 'STARTING\nOUT', value: 'JUNIOR', ariaLabel: 'Starting out' },
      { label: 'MID-LIFE', value: 'MID', ariaLabel: 'Mid-life' },
      'RETIRED',
    ],
  },
  {
    id: 'employmentStatus',
    label: 'employment status?',
    type: 'options' as const,
    options: [
      'STUDENT',
      'EMPLOYED',
      { label: 'BETWEEN\nJOBS', value: 'BETWEEN_JOBS', ariaLabel: 'Between jobs' },
    ],
  },
  { id: 'name', label: 'what should\nwe call you?', type: 'input' as const, placeholder: 'first name' },
]

const STORAGE_KEYS: Record<string, string> = { ...PROFILE_STORAGE_KEYS }

function resolveProfileGoal(v: Record<string, string>): string {
  return v.goal?.trim() || readStoredProfileGoal()
}

/**
 * POST /api/user can reattach to an existing account (session match, or name+postcode match)
 * and return a merged/updated row that differs from whatever was just typed locally — e.g. a
 * returning user on a browser with a stale session cookie gets the account's real stored name
 * back, not the name from this onboarding pass. Without this, localStorage (and everything that
 * reads from it — Zone greeting, Truth Ledger, summary) keeps showing the stale local values
 * forever, diverging from what the server actually persisted.
 */
function syncLocalStorageFromServerUser(user: Record<string, unknown> | undefined | null): void {
  if (!user || typeof window === 'undefined') return
  const setIfString = (key: string, value: unknown) => {
    if (typeof value === 'string' && value.trim()) localStorage.setItem(key, value)
  }
  setIfString(STORAGE_KEYS.name, user.name)
  setIfString(STORAGE_KEYS.postcode, user.postcode)
  setIfString(STORAGE_KEYS.livingSituation, user.household)
  setIfString(STORAGE_KEYS.homeType, user.home_type)
  setIfString(STORAGE_KEYS.transport, user.transport_baseline)
  setIfString(STORAGE_KEYS.age, user.age_group)
  setIfString(STORAGE_KEYS.employmentStatus, user.employment_status)
  const genome = user.user_genome && typeof user.user_genome === 'object'
    ? (user.user_genome as Record<string, unknown>)
    : null
  if (genome) {
    setIfString(STORAGE_KEYS.powerType, genome.home_power)
    setIfString(STORAGE_KEYS.homeOwnership, genome.home_ownership)
    setIfString(STORAGE_KEYS.washPreference, genome.wash_preference)
    setIfString(STORAGE_KEYS.flightFrequency, genome.flight_frequency)
    const goal = genome.profile_goal ?? genome.goal
    if (typeof goal === 'string' && goal.trim()) {
      try {
        localStorage.setItem(PROFILE_GOAL_STORAGE_KEY, goal)
      } catch {
        /* ignore */
      }
    }
  }
}

function isProfileOnboardingComplete(v: Record<string, string>): boolean {
  return isProfileOnboardingCompleteFields(v as ProfileOnboardingFields)
}

function firstIncompleteProfileStepIndex(v: Record<string, string>): number {
  for (let i = 0; i < PROFILE_QUESTIONS.length; i++) {
    const q = PROFILE_QUESTIONS[i]
    const raw = String(v[q.id] ?? '').trim()
    if (q.id === 'postcode') {
      if (!isValidUkPostcode(raw.replace(/\s+/g, ''))) return i
      continue
    }
    if (!raw) return i
  }
  return -1
}

export default function ProfilePageClient() {
  const reduceMotion = useHydrationSafeReducedMotion()
  const router = useRouter()
  const searchParams = useSearchParams()
  const qParam = searchParams?.get('q')
  const returnTo = searchParams?.get('returnTo')
  const skipParam = searchParams?.get('skip')
  const { refreshProfile, setLocationState } = useApp()

  const [step, setStepState] = useState(0)
  const setStep = useCallback((next: number | ((s: number) => number)) => {
    setStepState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next
      const clamped = Math.max(0, Math.min(resolved, PROFILE_QUESTIONS.length - 1))
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(PROFILE_STEP_KEY, String(clamped))
        } catch {
          // ignore
        }
      }
      return clamped
    })
  }, [])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const advancingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const houseNumberRef = useRef<HTMLInputElement>(null)
  const hydratedRef = useRef(false)
  const [profileHydrated, setProfileHydrated] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [keyboardLift, setKeyboardLift] = useState(false)
  const [postcodeLocalityLabel, setPostcodeLocalityLabel] = useState('')
  const [postcodeFormatValid, setPostcodeFormatValid] = useState(false)
  const [insightReveal, setInsightReveal] = useState<string | null>(null)
  const insightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /**
   * Guest-vs-create fork — shown once, before the first onboarding question, only on a
   * genuinely fresh visit (no deep link, no answers yet). Deliberately kept outside
   * PROFILE_QUESTIONS: that array drives the step/resume/completeness machinery and every
   * entry there is assumed to be a required, persisted field. This is neither — it's a
   * one-time routing choice, not profile data.
   *
   * Persisted to sessionStorage (not localStorage — this is a per-visit routing choice, not
   * profile data that should survive across devices/sessions) so a reload between choosing
   * CREATE and finishing the goal question doesn't bounce back to the fork screen. Anyone
   * who's already answered a real question is separately protected by hasAnsweredAnything
   * below regardless of this.
   */
  const [entryChoice, setEntryChoiceState] = useState<'create' | 'guest' | null>(null)
  const setEntryChoice = useCallback((next: 'create' | 'guest' | null) => {
    setEntryChoiceState(next)
    if (typeof window === 'undefined') return
    try {
      if (next) sessionStorage.setItem(PROFILE_ENTRY_CHOICE_KEY, next)
      else sessionStorage.removeItem(PROFILE_ENTRY_CHOICE_KEY)
    } catch {
      // ignore
    }
  }, [])

  const recenterProfileStep = useCallback(() => {
    setKeyboardLift(false)
    if (!isProfileMobileKeyboardViewport()) return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [])

  const liftProfileStepForKeyboard = useCallback(() => {
    if (!isProfileMobileKeyboardViewport()) return
    setKeyboardLift(true)
  }, [])

  useLayoutEffect(() => {
    if (PROFILE_QUESTIONS.length === 0) return
    if (step < 0 || step >= PROFILE_QUESTIONS.length) setStep(0)
  }, [step, setStep])

  useEffect(() => {
    advancingRef.current = false
  }, [step])

  useEffect(() => {
    router.prefetch(ROUTES.PROFILE_SUMMARY)
  }, [router])

  useEffect(() => {
    submittingRef.current = false
    setIsSubmitting(false)
  }, [])

  useLayoutEffect(() => {
    if (hydratedRef.current || typeof window === 'undefined') return
    hydratedRef.current = true
    try {
      const storedEntryChoice = sessionStorage.getItem(PROFILE_ENTRY_CHOICE_KEY)
      if (storedEntryChoice === 'create' || storedEntryChoice === 'guest') {
        setEntryChoiceState(storedEntryChoice)
      }
    } catch {
      // ignore
    }
    const stored: Record<string, string> = {}
    PROFILE_QUESTIONS.forEach((q) => {
      const val = localStorage.getItem(STORAGE_KEYS[q.id] ?? q.id)
      if (!val) return
      stored[q.id] = q.id === 'name' ? firstNameFromAutofill(val) : val
    })
    const storedHouse = localStorage.getItem(STORAGE_KEYS.houseNumber)
    if (storedHouse) stored.houseNumber = storedHouse
    const storedGoal = readStoredProfileGoal()
    if (storedGoal) stored.goal = storedGoal
    if (Object.keys(stored).length > 0) {
      setValues(stored)
    }
    let nextStep = 0
    if (qParam) {
      const index = PROFILE_QUESTIONS.findIndex(
        (q) => q.id === qParam || (qParam === 'homePower' && q.id === 'powerType')
      )
      if (index !== -1) nextStep = index
    } else {
      // A stored step index only means "resume here" if every question before it is actually
      // answered in `stored`. Otherwise a stale index (e.g. from an earlier attempt whose
      // localStorage got cleared/reset) would skip straight past an unanswered question —
      // postcode being step 0, this is exactly how it went missing.
      const incomplete = firstIncompleteProfileStepIndex(
        Object.keys(stored).length > 0 ? stored : {}
      )
      const incompleteCap = incomplete >= 0 ? incomplete : PROFILE_QUESTIONS.length - 1
      try {
        const raw = sessionStorage.getItem(PROFILE_STEP_KEY)
        const n = raw ? parseInt(raw, 10) : NaN
        if (Number.isFinite(n) && n >= 0 && n < PROFILE_QUESTIONS.length) {
          nextStep = Math.min(n, incompleteCap)
        } else if (incomplete >= 0) {
          nextStep = incomplete
        }
      } catch {
        if (incomplete >= 0) nextStep = incomplete
      }
    }
    setStep(nextStep)
    setProfileHydrated(true)
  }, [qParam, setStep])

  /**
   * Returning-user fallback — localStorage alone is not durable (cleared cache, new device,
   * private browsing). If the DB-backed session/guest profile is already complete, skip
   * onboarding instead of forcing all 8 steps again. Never fires on the Settings single-field
   * edit deep link (`q`/`returnTo` present) — that visit to `/profile` is intentional.
   */
  useEffect(() => {
    if (!profileHydrated) return
    if (qParam || returnTo || skipParam === '1') return
    if (submittingRef.current) return
    if (isProfileOnboardingComplete(values)) {
      router.replace(ROUTES.ZONE)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const userRes = await fetch('/api/user', { cache: 'no-store' })
        const userJson = await userRes.json().catch(() => null)
        if (cancelled) return
        if (userJson?.user && userRowOnboardingComplete(userJson.user)) {
          router.replace(ROUTES.ZONE)
          return
        }
        const sessionRes = await fetch('/api/session-state', { cache: 'no-store' })
        const sessionJson = await sessionRes.json().catch(() => null)
        if (cancelled) return
        if (sessionJson?.profile && guestProfileOnboardingComplete(sessionJson.profile)) {
          router.replace(ROUTES.ZONE)
        }
      } catch {
        /* network failure — fall through to onboarding, never block on this check */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [profileHydrated, qParam, returnTo, skipParam, values, router])

  /**
   * Goal ("save money" / "reduce carbon" / "or both") used to live on a separate /intro?step=goal
   * page that this component bounced out to and back from. It's now asked inline, right after the
   * guest/create fork and before postcode — see showGoalStep below. This effect just keeps `values`
   * in sync if a goal already exists in localStorage (e.g. returning user), it no longer redirects.
   */
  useEffect(() => {
    if (!profileHydrated) return
    const goal = resolveProfileGoal(values)
    if (goal) return
    const storedGoal = readStoredProfileGoal()
    if (storedGoal) {
      setValues((prev) => (prev.goal?.trim() ? prev : { ...prev, goal: storedGoal }))
    }
  }, [profileHydrated, values])

  /** Mobile: lift step when software keyboard opens; recenter when it closes. */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const vv = window.visualViewport
    const sync = () => {
      if (!isProfileMobileKeyboardViewport()) {
        setKeyboardLift(false)
        return
      }
      const gap = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0
      if (gap > 72) {
        setKeyboardLift(true)
        return
      }
      recenterProfileStep()
    }
    if (vv) {
      vv.addEventListener('resize', sync)
      vv.addEventListener('scroll', sync)
    }
    window.addEventListener('focusout', sync)
    return () => {
      if (vv) {
        vv.removeEventListener('resize', sync)
        vv.removeEventListener('scroll', sync)
      }
      window.removeEventListener('focusout', sync)
    }
  }, [step, recenterProfileStep])

  useEffect(() => {
    recenterProfileStep()
  }, [step, recenterProfileStep])

  const setValue = useCallback((id: string, value: string) => {
    const nextValue =
      id === 'name'
        ? firstNameFromAutofill(value)
        : id === 'postcode'
          ? value.replace(/\s+/g, ' ').trim().toUpperCase()
          : id === 'houseNumber'
            ? value.replace(/\s+/g, ' ').trim()
            : value
    if (id === 'postcode' && typeof window !== 'undefined') {
      const prev = (values.postcode ?? localStorage.getItem(STORAGE_KEYS.postcode) ?? '')
        .replace(/\s+/g, '')
        .trim()
        .toUpperCase()
      const next = nextValue.replace(/\s+/g, '').trim().toUpperCase()
      if (prev.length >= 4 && next.length >= 4 && prev !== next) {
        clearZoneVmLocalCache({ preservePostcode: next })
      }
    }
    setValues((prev) => ({ ...prev, [id]: nextValue }))
    const key = STORAGE_KEYS[id] ?? id
    if (typeof window !== 'undefined') {
      if (id === 'houseNumber' && !nextValue) {
        localStorage.removeItem(key)
      } else {
        localStorage.setItem(key, nextValue)
      }
      if (id === 'powerType') persistHomePowerFromProfile(nextValue)
      try {
        persistUnifiedUserProfileMemory()
      } catch {
        // ignore
      }
    }
  }, [values.postcode])

  /** Goal uses its own storage key (PROFILE_GOAL_STORAGE_KEY), not STORAGE_KEYS — same write path
   *  as IntroScreen's handleGoalSelect and Settings' SettingsProfileGoalRow, so all three stay
   *  consistent with each other. */
  const handleGoalSelect = useCallback((value: ProfileGoalValue) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(PROFILE_GOAL_STORAGE_KEY, value)
      try {
        persistUnifiedUserProfileMemory()
      } catch {
        // ignore
      }
      syncSessionState()
    }
    setValues((prev) => ({ ...prev, goal: value }))
  }, [])

  const current = PROFILE_QUESTIONS[step]
  const currentVal = values[current?.id] ?? ''

  useEffect(() => {
    const pc = (values.postcode ?? '').replace(/\s+/g, '').trim()
    if (pc.length < 2) {
      setPostcodeLocalityLabel('')
      setPostcodeFormatValid(false)
      return
    }
    const valid = isValidUkPostcode(pc)
    setPostcodeFormatValid(valid)
    if (!valid) {
      setPostcodeLocalityLabel('')
      return
    }
    const cached = readCachedProfileLocality(pc)
    setPostcodeLocalityLabel(cached && isRealLocalityLabel(cached) ? cached : '')
    const houseNumber = (values.houseNumber ?? '').trim()
    const tid = window.setTimeout(() => {
      void prefetchProfileLocalityForHandoff(pc)
        .then(({ label, local }) => {
          if (!isRealLocalityLabel(label)) return
          setPostcodeLocalityLabel(label)
          if (local) setLocationState({ locationName: label, local })
        })
        .catch(() => {})
      void fetch('/api/local-intelligence', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postcode: pc,
          ...(houseNumber ? { house_number: houseNumber } : {}),
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d || typeof d.council !== 'string') return
          const local: LocalIntelligence = {
            council: d.council,
            region: typeof d.region === 'string' ? d.region : d.council,
            localCarbonG: typeof d.localCarbonG === 'number' ? d.localCarbonG : undefined,
            ward: typeof d.ward === 'string' ? d.ward : undefined,
            locality: typeof d.locality === 'string' ? d.locality : undefined,
            outcode: typeof d.outcode === 'string' ? d.outcode : undefined,
            country: typeof d.country === 'string' ? d.country : undefined,
          }
          const locationName = formatLocationDisplayName(local, pc)
          if (!isRealLocalityLabel(locationName)) return
          persistProfileLocality(pc, locationName)
          setPostcodeLocalityLabel(locationName)
          setLocationState({ locationName, local })

          const epc = d?.openDataAnchor?.epc as
            | { found?: boolean; addressMatched?: boolean; propertyType?: string }
            | undefined
          if (epc?.found && epc.addressMatched && !localStorage.getItem('profile_home_type')) {
            const hint = mapEpcPropertyTypeToHomeTypeHint(epc.propertyType)
            if (hint) {
              localStorage.setItem('profile_home_type', hint)
              setValues((prev) => ({ ...prev, homeType: hint }))
              try {
                persistUnifiedUserProfileMemory()
              } catch {
                // ignore
              }
            }
          }
        })
        .catch(() => {})
    }, 150)
    return () => window.clearTimeout(tid)
  }, [values.postcode, values.houseNumber, setLocationState])

  const {
    postcode: profilePostcodeField,
    homeType: profileHomeTypeField,
    powerType: profilePowerTypeField,
    transport: profileTransportField,
    livingSituation: profileLivingSituationField,
    employmentStatus: profileEmploymentStatusField,
    houseNumber: profileHouseNumberField,
    goal: profileGoalField,
  } = values

  useEffect(() => {
    const pc = (profilePostcodeField ?? '').replace(/\s+/g, '').trim().toUpperCase()
    if (pc.length < 4) return
    const tid = window.setTimeout(() => {
      if (!browserCanTriggerScrapeSync()) return
      const profileGoal = profileGoalField?.trim() || readStoredProfileGoal()
      const profileData = buildResearchProfilePayload({
        postcode: pc,
        homeType: profileHomeTypeField,
        powerType: profilePowerTypeField,
        transport: profileTransportField,
        livingSituation: profileLivingSituationField,
        employmentStatus: profileEmploymentStatusField,
        houseNumber: profileHouseNumberField,
        goal: profileGoal,
      })
      triggerScrapeSyncForCategory({ postcode: pc, category: 'home', profileData })
      if (profilePowerTypeField?.trim()) {
        triggerScrapeSyncForCategory({ postcode: pc, category: 'utilities', profileData })
      }
    }, 400)
    return () => window.clearTimeout(tid)
  }, [
    profilePostcodeField,
    profileHomeTypeField,
    profilePowerTypeField,
    profileTransportField,
    profileLivingSituationField,
    profileEmploymentStatusField,
    profileHouseNumberField,
    profileGoalField,
  ])

  const submitProfile = useCallback(
    (finalValues: Record<string, string>, overrideReturnTo?: string) => {
      if (submittingRef.current) return
      const mergedValues: Record<string, string> = {
        ...finalValues,
        goal: resolveProfileGoal(finalValues),
      }
      let dest = overrideReturnTo || returnTo || ROUTES.PROFILE_SUMMARY
      dest = dest.trim()
      if (!dest.startsWith('http') && !dest.startsWith('/')) dest = `/${dest.replace(/^\/+/, '')}`
      if (!isProfileOnboardingComplete(mergedValues)) {
        advancingRef.current = false
        if (!resolveProfileGoal(mergedValues)) {
          router.replace(`${ROUTES.INTRO}?step=goal`)
          return
        }
        const idx = firstIncompleteProfileStepIndex(mergedValues)
        if (idx >= 0) setStep(idx)
        return
      }

      submittingRef.current = true
      setIsSubmitting(true)
      trackFunnelEvent('profile_complete', { page: dest })

      if (typeof window !== 'undefined') {
        Object.entries(mergedValues).forEach(([id, val]) => {
          const key = id === 'goal' ? PROFILE_GOAL_STORAGE_KEY : STORAGE_KEYS[id]
          if (!key || typeof val !== 'string') return
          if (id === 'houseNumber' && !val.trim()) {
            localStorage.removeItem(key)
            return
          }
          if (val.trim()) localStorage.setItem(key, val.trim())
        })
        if (mergedValues.powerType?.trim()) persistHomePowerFromProfile(mergedValues.powerType)
        try {
          persistUnifiedUserProfileMemory()
        } catch {
          // ignore
        }

        syncSessionState()
        try {
          sessionStorage.removeItem(PROFILE_STEP_KEY)
        } catch {
          // ignore
        }
      }

      refreshProfile()
      if (typeof window !== 'undefined') {
        void (async () => {
          const pc = (mergedValues.postcode ?? '').replace(/\s+/g, '').trim().toUpperCase()
          const payload = {
            name: mergedValues.name ?? '',
            postcode: mergedValues.postcode ?? '',
            household: mergedValues.livingSituation ?? '',
            home_type: mergedValues.homeType ?? '',
            transport: mergedValues.transport ?? '',
            age_group: (mergedValues.age as ProfileAge) ?? undefined,
            employment_status: mergedValues.employmentStatus ?? undefined,
            goal: mergedValues.goal ?? undefined,
            house_number: mergedValues.houseNumber?.trim() || undefined,
            home_power: mergedValues.powerType?.trim() || undefined,
            home_ownership: mergedValues.homeOwnership?.trim() || undefined,
            wash_preference: mergedValues.washPreference?.trim() || undefined,
            flight_frequency: mergedValues.flightFrequency?.trim() || undefined,
          }
          const profileData = buildResearchProfilePayload(mergedValues, { postcode: pc })

          try {
            const res = await Promise.race([
              createUser(payload),
              new Promise<never>((_, reject) =>
                window.setTimeout(() => reject(new Error('createUser timeout')), 8000)
              ),
            ])
            applyPropertyPrefillFromApiResponse(res)
            syncLocalStorageFromServerUser(res?.user)
            const userId = res?.user?.id ?? res?.id
            if (userId) {
              persistSessionRestoreProof(
                typeof res?.restore_proof === 'string' ? res.restore_proof : null
              )
            }
            refreshProfile()
            const location = res?.location
            if (location && typeof location.council === 'string') {
              const local: LocalIntelligence = {
                council: location.council,
                region: typeof location.region === 'string' ? location.region : location.council,
                localCarbonG: typeof location.localCarbonG === 'number' ? location.localCarbonG : undefined,
                ward: typeof location.ward === 'string' ? location.ward : undefined,
                locality: typeof location.locality === 'string' ? location.locality : undefined,
                outcode: typeof location.outcode === 'string' ? location.outcode : undefined,
                country: typeof location.country === 'string' ? location.country : undefined,
              }
              const locationName = formatLocationDisplayName(local, mergedValues.postcode ?? '')
              if (locationName) {
                persistProfileLocality(mergedValues.postcode ?? '', locationName)
                setLocationState({ locationName, local })
              }
            }
            try {
              persistUnifiedUserProfileMemory()
            } catch {
              // ignore
            }
            void import('@/lib/sessionStateSync').then((m) => m.syncSessionState())

            if (pc.length >= 4) {
              triggerOnboardingResearchBootstrap({ postcode: pc, profileData, dedupe: true })
            }
          } catch {
            refreshProfile()
            try {
              persistUnifiedUserProfileMemory()
            } catch {
              // ignore
            }
          }

          if (pc.length >= 4) {
            try {
              await Promise.race([
                prefetchProfileLocalityForHandoff(pc).then(({ label, local }) => {
                  if (label) persistProfileLocality(pc, label)
                  if (local) {
                    const locationName = formatLocationDisplayName(local, pc) || label
                    setLocationState({ locationName, local })
                  }
                }),
                new Promise<void>((resolve) => window.setTimeout(resolve, 2600)),
              ])
            } catch {
              /* offline — summary will retry */
            }
          }

          window.location.assign(dest)
        })().finally(() => {
          submittingRef.current = false
          setIsSubmitting(false)
        })
        return
      }
      router.replace(dest)

      const payload = {
        name: mergedValues.name ?? '',
        postcode: mergedValues.postcode ?? '',
        household: mergedValues.livingSituation ?? '',
        home_type: mergedValues.homeType ?? '',
        transport: mergedValues.transport ?? '',
        age_group: (mergedValues.age as ProfileAge) ?? undefined,
        employment_status: mergedValues.employmentStatus ?? undefined,
        goal: mergedValues.goal ?? undefined,
        house_number: mergedValues.houseNumber?.trim() || undefined,
        home_power: mergedValues.powerType?.trim() || undefined,
      }

      void createUser(payload)
        .then((res) => {
          syncLocalStorageFromServerUser(res?.user)
          const userId = res?.user?.id ?? res?.id
          if (typeof window !== 'undefined' && userId) {
            persistSessionRestoreProof(
              typeof res?.restore_proof === 'string' ? res.restore_proof : null
            )
          }
          refreshProfile()
          const location = res?.location
          if (location && typeof location.council === 'string') {
            const local: LocalIntelligence = {
              council: location.council,
              region: typeof location.region === 'string' ? location.region : location.council,
              localCarbonG: typeof location.localCarbonG === 'number' ? location.localCarbonG : undefined,
              ward: typeof location.ward === 'string' ? location.ward : undefined,
              locality: typeof location.locality === 'string' ? location.locality : undefined,
              outcode: typeof location.outcode === 'string' ? location.outcode : undefined,
              country: typeof location.country === 'string' ? location.country : undefined,
            }
            const locationName = formatLocationDisplayName(local, mergedValues.postcode ?? '')
            if (locationName) {
              persistProfileLocality(mergedValues.postcode ?? '', locationName)
              setLocationState({ locationName, local })
            }
          }
          try {
            persistUnifiedUserProfileMemory()
          } catch {
            // ignore
          }
          void import('@/lib/sessionStateSync').then((m) => m.syncSessionState())
        })
        .catch(() => {
          refreshProfile()
          try {
            persistUnifiedUserProfileMemory()
          } catch {
            // ignore
          }
        })
        .finally(() => {
          submittingRef.current = false
          setIsSubmitting(false)
        })
    },
    [refreshProfile, router, returnTo, setLocationState, setStep]
  )

  const persistStepValues = useCallback((nextValues: Record<string, string>) => {
    flushSync(() => {
      setValues((prev) => ({ ...prev, ...nextValues }))
      if (typeof window !== 'undefined') {
        Object.entries(nextValues).forEach(([id, val]) => {
          const key = STORAGE_KEYS[id] ?? id
          if (typeof val !== 'string') return
          if (id === 'houseNumber' && !val.trim()) {
            localStorage.removeItem(key)
            return
          }
          if (val.trim()) localStorage.setItem(key, val.trim())
        })
        if (nextValues.powerType?.trim()) persistHomePowerFromProfile(nextValues.powerType)
      }
    })
  }, [])

  const advanceProfileStep = useCallback(
    (nextValues: Record<string, string>) => {
      if (submittingRef.current || isSubmitting) return
      const atLast = step >= PROFILE_QUESTIONS.length - 1

      if (atLast) {
        submitProfile(nextValues, returnTo || undefined)
        return
      }

      persistStepValues(nextValues)
      setStep((s) => s + 1)
    },
    [step, returnTo, submitProfile, isSubmitting, persistStepValues, setStep]
  )

  const advanceWithInsight = useCallback(
    (nextValues: Record<string, string>, insightText: string | null) => {
      if (!insightText) {
        advanceProfileStep(nextValues)
        return
      }
      setInsightReveal(insightText)
      insightTimerRef.current = setTimeout(() => {
        setInsightReveal(null)
        advanceProfileStep(nextValues)
      }, 5000)
    },
    [advanceProfileStep]
  )

  const readLiveFieldValue = useCallback(() => {
    if (current?.type === 'input' && inputRef.current) {
      return inputRef.current.value.trim()
    }
    return (values[current?.id ?? ''] ?? '').trim()
  }, [current, values])

  const commitInputStep = useCallback(() => {
    if (!current || advancingRef.current || submittingRef.current || isSubmitting) return
    advancingRef.current = true

    let nextValues: Record<string, string>
    if (current.id === 'postcode') {
      const trimmedPc = (inputRef.current?.value ?? values.postcode ?? '').trim()
      const compact = trimmedPc.replace(/\s+/g, '').toUpperCase()
      if (!isValidUkPostcode(compact)) {
        advancingRef.current = false
        return
      }
      const trimmedHouse = (houseNumberRef.current?.value ?? values.houseNumber ?? '').trim()
      inputRef.current?.blur()
      houseNumberRef.current?.blur()
      recenterProfileStep()
      nextValues = {
        ...values,
        postcode: checkUkPostcode(compact).normalized,
        houseNumber: trimmedHouse,
      }
    } else {
      const trimmed = readLiveFieldValue()
      if (current.type === 'input' && !trimmed) {
        advancingRef.current = false
        return
      }
      inputRef.current?.blur()
      recenterProfileStep()
      nextValues = { ...values, [current.id]: trimmed }
    }

    flushSync(() => {
      persistStepValues(nextValues)
    })
    const insight = current.getInsight?.(nextValues[current.id] ?? '', postcodeLocalityLabel) ?? null
    advanceWithInsight(nextValues, insight)
  }, [
    current,
    values,
    isSubmitting,
    postcodeLocalityLabel,
    readLiveFieldValue,
    recenterProfileStep,
    persistStepValues,
    advanceWithInsight,
  ])

  const handleNext = useCallback(() => {
    commitInputStep()
  }, [commitInputStep])

  const handlePostcodeContinue = useCallback(() => {
    commitInputStep()
  }, [commitInputStep])

  useEffect(() => () => { if (insightTimerRef.current) clearTimeout(insightTimerRef.current) }, [])

  if (!current) return null

  const handleOptionClick = (opt: unknown) => {
    if (submittingRef.current || isSubmitting) return
    const isObj = typeof opt === 'object' && opt !== null
    const optValue = isObj ? String((opt as { value: string }).value) : String(opt)
    const isLastStep = step >= PROFILE_QUESTIONS.length - 1

    const persistAndAdvance = (nextValues: Record<string, string>) => {
      if (typeof window !== 'undefined') {
        const key = STORAGE_KEYS[current.id] ?? current.id
        localStorage.setItem(key, optValue)
        Object.entries(nextValues).forEach(([id, val]) => {
          const k = STORAGE_KEYS[id] ?? id
          if (typeof val === 'string' && val.trim()) localStorage.setItem(k, val.trim())
        })
        if (nextValues.powerType?.trim()) persistHomePowerFromProfile(nextValues.powerType)
        try {
          persistUnifiedUserProfileMemory()
        } catch {
          // ignore
        }
      }
      if (isLastStep) {
        submitProfile(nextValues, returnTo || undefined)
        return
      }
      persistStepValues(nextValues)
      setStep((s) => s + 1)
    }

    if (isLastStep) {
      flushSync(() => {
        setValues((prev) => ({ ...prev, [current.id]: optValue }))
      })
      persistAndAdvance({ ...values, [current.id]: optValue })
      return
    }

    const insight = current.getInsight?.(optValue, postcodeLocalityLabel) ?? null
    setValue(current.id, optValue)
    if (insight) {
      persistStepValues({ ...values, [current.id]: optValue })
      setInsightReveal(insight)
      insightTimerRef.current = setTimeout(() => {
        setInsightReveal(null)
        persistAndAdvance({ ...values, [current.id]: optValue })
      }, 5000)
      return
    }
    persistAndAdvance({ ...values, [current.id]: optValue })
  }

  const questionBlockLabel = profileHydrated && current ? current.label.replace(/\n/g, '\n') : ''
  const stepMotion = familyProfileStepProps(reduceMotion)
  const headlineMotion = familyAtomicProps(reduceMotion)

  const profileShellStyle: React.CSSProperties = {
    minHeight: '100dvh',
    height: 'auto',
    maxHeight: 'none',
    overflow: 'auto',
    boxSizing: 'border-box',
    padding: 'clamp(20px, 3vw, 40px)',
    paddingTop: 'max(clamp(20px, 3vw, 40px), env(safe-area-inset-top, 0px))',
    paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 40,
  }

  const profileShellClass = keyboardLift ? 'zz-profile-page zz-profile-page--keyboard' : 'zz-profile-page'

  if (!profileHydrated || !current) {
    return (
      <main className={profileShellClass} style={profileShellStyle} aria-busy="true" aria-label="Loading profile" />
    )
  }

  // Only a fresh visit sees the fork — deep links (Settings edits via ?q=/?returnTo=) and anyone
  // who's already answered a question skip straight past it, so it never interrupts a resumed
  // flow. Deliberately NOT gated on skipParam: IntroScreen always appends ?skip=1 when handing
  // off from the intro/goal screen on `/` to `/profile` (see app/components/IntroScreen.tsx) —
  // that's every normal first-time visitor, so treating it as "skip the fork too" made the fork
  // unreachable in practice. skip=1 means "skip re-showing the intro screen," not "skip this."
  const hasAnsweredAnything = PROFILE_QUESTIONS.some((q) => (values[q.id] ?? '').trim())
  const showEntryFork = !qParam && !returnTo && entryChoice === null && !hasAnsweredAnything

  if (showEntryFork) {
    return (
      <main className={profileShellClass} style={profileShellStyle}>
        <AnimatePresence mode="wait">
          <motion.div
            key="entry-fork"
            className="profile-step-slam w-full flex flex-col items-center"
            style={{ gap: 40, maxWidth: 800 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <h2
              className="zz-h2 text-marvin m-0 text-center"
              style={{ whiteSpace: 'pre-line', maxWidth: 'min(92vw, 48rem)' }}
            >
              quick look, or make it yours?
            </h2>
            <div className="profile-step-controls profile-step-controls--options">
              <ProfileAnswerBtn
                reduceMotion={reduceMotion}
                optionIndex={0}
                delaySeconds={familyControlDelaySec(0)}
                className=""
                onClick={() => setEntryChoice('guest')}
                aria-label="Guest"
              >
                <span className="profile-answer-btn__text zz-h4">GUEST</span>
              </ProfileAnswerBtn>
              <ProfileAnswerBtn
                reduceMotion={reduceMotion}
                optionIndex={1}
                delaySeconds={familyControlDelaySec(1)}
                className=""
                onClick={() => setEntryChoice('create')}
                aria-label="Create"
              >
                <span className="profile-answer-btn__text zz-h4">CREATE</span>
              </ProfileAnswerBtn>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>
    )
  }

  if (entryChoice === 'guest') {
    return (
      <main className={profileShellClass} style={profileShellStyle}>
        <AnimatePresence mode="wait">
          <motion.div
            key="guest-coming-soon"
            className="profile-step-slam w-full flex flex-col items-center"
            style={{ gap: 40, maxWidth: 800 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <h2
              className="zz-h2 text-marvin m-0 text-center"
              style={{ color: 'var(--color-yellow)', whiteSpace: 'pre-line', maxWidth: 'min(92vw, 48rem)' }}
            >
              guest is nearly ready.{'\n'}for now, create takes{'\n'}about a minute.
            </h2>
            <ProfileAnswerBtn
              reduceMotion={reduceMotion}
              optionIndex={0}
              delaySeconds={familyControlDelaySec(0)}
              className=""
              onClick={() => setEntryChoice('create')}
              aria-label="Create"
            >
              <span className="profile-answer-btn__text zz-h4">CREATE</span>
            </ProfileAnswerBtn>
          </motion.div>
        </AnimatePresence>
      </main>
    )
  }

  // Second question, right after the fork: save money / reduce carbon / or both. Same
  // deep-link rules as the fork above (and same reason skipParam is deliberately excluded —
  // IntroScreen's handoff always carries ?skip=1, which would otherwise make this unreachable
  // for every normal first-time visitor). Skipped once a goal already exists. Reuses
  // INTRO_GOAL_QUESTION / PROFILE_GOAL_CHOICES so this matches the (now unreachable in the
  // main flow) /intro goal screen and Settings' goal editor exactly.
  const showGoalStep = !qParam && !returnTo && !resolveProfileGoal(values)

  if (showGoalStep) {
    return (
      <main className={profileShellClass} style={profileShellStyle}>
        <AnimatePresence mode="wait">
          <motion.div
            key="goal-step"
            className="profile-step-slam w-full flex flex-col items-center"
            style={{ gap: 40, maxWidth: 800 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <h2
              className="zz-h2 text-marvin m-0 text-center"
              style={{ whiteSpace: 'pre-line', maxWidth: 'min(92vw, 48rem)' }}
            >
              {INTRO_GOAL_QUESTION}
            </h2>
            <div className="profile-step-controls profile-step-controls--options">
              {PROFILE_GOAL_CHOICES.map((choice, optionIndex) => (
                <ProfileAnswerBtn
                  key={choice.value}
                  reduceMotion={reduceMotion}
                  optionIndex={optionIndex}
                  delaySeconds={familyControlDelaySec(optionIndex)}
                  className=""
                  style={
                    choice.theme
                      ? ({ '--local-theme': choice.theme } as CSSProperties & { '--local-theme'?: string })
                      : undefined
                  }
                  onClick={() => handleGoalSelect(choice.value)}
                  aria-label={choice.ariaLabel}
                >
                  <span className="profile-answer-btn__text zz-h4 intro-goal-btn__text">
                    {choice.displayLabel}
                  </span>
                </ProfileAnswerBtn>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </main>
    )
  }

  return (
    <main className={profileShellClass} style={profileShellStyle}>
      <AnimatePresence mode="wait">
        {insightReveal ? (
          <motion.div
            key="insight-reveal"
            className="profile-step-slam w-full flex flex-col items-center"
            style={{ gap: 16, maxWidth: 800 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <h2
              className="zz-h2 text-marvin m-0 text-center"
              style={{ color: 'var(--color-yellow)', whiteSpace: 'pre-line', maxWidth: 'min(92vw, 48rem)' }}
            >
              {insightReveal}
            </h2>
          </motion.div>
        ) : (
        <motion.div
          key={step}
          className="profile-step-slam w-full flex flex-col items-center"
          style={{ gap: 40, maxWidth: 800 }}
          initial={stepMotion.initial}
          animate={stepMotion.animate}
          exit={stepMotion.exit}
          transition={FAMILY_TRANSITION_ATOMIC}
        >
          <motion.div
            className="text-marvin profile-question-headline"
            style={{
              marginBottom: 0,
              marginLeft: 'auto',
              marginRight: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.06em',
              maxWidth: 'min(92vw, 48rem)',
              textAlign: 'center',
            }}
            initial={headlineMotion.initial}
            animate={headlineMotion.animate}
            exit={headlineMotion.exit}
            transition={FAMILY_TRANSITION_ATOMIC}
          >
            <span style={{ whiteSpace: 'pre-line', display: 'block' }}>{questionBlockLabel}</span>
          </motion.div>
          {current.type === 'input' ? (
            <div className="profile-step-controls profile-step-controls--input">
              {current.id === 'postcode' ? (
                <div className="profile-postcode-stack">
                  <InputField
                    ref={inputRef}
                    value={currentVal}
                    onChange={(v) => setValue('postcode', v)}
                    onAdvance={handlePostcodeContinue}
                    onFocusLift={liftProfileStepForKeyboard}
                    onBlurViewportReset={recenterProfileStep}
                    placeholder={
                      (current as { label: string; placeholder?: string }).placeholder ?? current.label
                    }
                    autoComplete="postal-code"
                    name="postal-code"
                    autoFocus
                  />
                  {postcodeLocalityLabel ? (
                    <h4 className="zz-h4 m-0 profile-postcode-locality" aria-live="polite">
                      {postcodeLocalityLabel}
                    </h4>
                  ) : null}
                </div>
              ) : (
                <InputField
                  ref={inputRef}
                  value={currentVal}
                  onChange={(v) => setValue(current.id, v)}
                  onAdvance={handleNext}
                  onFocusLift={liftProfileStepForKeyboard}
                  onBlurViewportReset={recenterProfileStep}
                  placeholder={
                    (current as { label: string; placeholder?: string }).placeholder ?? current.label
                  }
                  autoComplete={current.id === 'name' ? 'given-name' : undefined}
                  name={current.id === 'name' ? 'given-name' : undefined}
                  autoFocus
                />
              )}
              <ProfileAnswerBtn
                reduceMotion={reduceMotion}
                optionIndex={0}
                delaySeconds={familyControlDelaySec(0)}
                className=""
                disabled={isSubmitting || (current.id === 'postcode' && !postcodeFormatValid)}
                onClick={commitInputStep}
                aria-label="Continue"
              >
                <span className="profile-answer-btn__text zz-h4">CONTINUE</span>
              </ProfileAnswerBtn>
            </div>
          ) : (
            <div className="profile-step-controls profile-step-controls--options">
              {(current.options ?? []).map((opt: any, optionIndex: number) => {
                const isObj = typeof opt === 'object' && opt !== null
                const optLabel = isObj ? opt.label : opt
                const optValue = isObj ? opt.value : opt
                const optTheme = isObj ? opt.theme : undefined
                const optAria =
                  isObj && typeof opt.ariaLabel === 'string' && opt.ariaLabel.trim()
                    ? opt.ariaLabel.trim()
                    : String(optLabel).replace(/_/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()

                return (
                  <ProfileAnswerBtn
                    key={optValue}
                    reduceMotion={reduceMotion}
                    optionIndex={optionIndex}
                    delaySeconds={familyControlDelaySec(optionIndex)}
                    className={currentVal === optValue ? 'selected' : ''}
                    style={optTheme ? ({ '--local-theme': optTheme } as CSSProperties & { '--local-theme'?: string }) : undefined}
                    disabled={isSubmitting}
                    onClick={() => handleOptionClick(opt)}
                    aria-label={optAria}
                  >
                    <span className="profile-answer-btn__text zz-h4">
                      {typeof optLabel === 'string' ? optLabel.replace(/_/g, '\n') : optLabel}
                    </span>
                  </ProfileAnswerBtn>
                )
              })}
            </div>
          )}
        </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
