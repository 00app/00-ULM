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
import { persistProfileLocality, prefetchProfileLocalityForHandoff, resolveProfileLocalityForPostcode } from '@/lib/geocode/resolvePostcodeLocality'
import type { LocalIntelligence } from '@/lib/local/getLocalData'
import { clearZoneVmLocalCache } from '@/lib/zone/clearZoneVmCache'
import { persistHomePowerFromProfile, profileHomePowerToEnergyType } from '@/lib/profile/homePower'
import { syncSessionState } from '@/lib/sessionStateSync'
import { browserCanTriggerScrapeSync } from '@/lib/researchSyncClient'
import { mapEpcPropertyTypeToHomeTypeHint } from '@/lib/epc/mapEpcToProfileHints'
import { flushSync } from 'react-dom'

/** Software-keyboard lift — phones only; tablet (768+) and desktop stay centred. */
const PROFILE_MOBILE_KEYBOARD_MQ = '(max-width: 767px)'

function isProfileMobileKeyboardViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(PROFILE_MOBILE_KEYBOARD_MQ).matches
}

const PROFILE_QUESTIONS = [
  { id: 'name', label: 'name', type: 'input' as const, placeholder: 'alex' },
  { id: 'postcode', label: 'postcode', type: 'input' as const, placeholder: 'postcode' },
  {
    id: 'livingSituation',
    label: 'who do you live with?',
    type: 'options' as const,
    options: ['ALONE', 'COUPLE', 'FAMILY', 'SHARED'],
  },
  { id: 'homeType', label: 'your home?', type: 'options' as const, options: ['FLAT', 'HOUSE'] },
  {
    id: 'powerType',
    label: 'power type?',
    type: 'options' as const,
    options: [
      'GAS',
      'ELECTRIC',
      { label: 'MIXED', value: 'MIX', ariaLabel: 'Mixed — gas and electric' },
      'OTHER',
    ],
  },
  {
    id: 'transport',
    label: 'how do you get around?',
    type: 'options' as const,
    options: ['WALK', 'BIKE', 'PUBLIC', 'CAR', 'MIX'],
  },
  {
    id: 'age',
    label: 'how old are you?',
    type: 'options' as const,
    options: ['JUNIOR', 'MID', 'RETIRED'] as ProfileAge[],
  },
  {
    id: 'employmentStatus',
    label: 'employment status?',
    type: 'options' as const,
    options: [
      'EMPLOYED',
      { label: 'SELF-\nEMPLOYED', value: 'SELF_EMPLOYED', ariaLabel: 'Self-employed' },
      { label: 'NOT WORK', value: 'UNEMPLOYED', ariaLabel: 'Not in paid work' },
    ],
  },
]

const PROFILE_GOAL_STORAGE_KEY = 'profile_goal'

const STORAGE_KEYS: Record<string, string> = {
  name: 'profile_name',
  postcode: 'profile_postcode',
  houseNumber: 'profile_house_number',
  livingSituation: 'profile_household',
  homeType: 'profile_home_type',
  powerType: 'profile_home_power',
  transport: 'profile_transport',
  age: 'profile_age',
  employmentStatus: 'profile_employment_status',
}

function readStoredProfileGoal(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(PROFILE_GOAL_STORAGE_KEY)?.trim() ?? ''
}

function resolveProfileGoal(v: Record<string, string>): string {
  return v.goal?.trim() || readStoredProfileGoal()
}

function isProfileOnboardingComplete(v: Record<string, string>): boolean {
  const pc = (v.postcode ?? '').replace(/\s+/g, '').trim()
  return (
    Boolean(v.name?.trim()) &&
    pc.length >= 4 &&
    Boolean(v.livingSituation?.trim()) &&
    Boolean(v.homeType?.trim()) &&
    Boolean(v.powerType?.trim()) &&
    Boolean(v.transport?.trim()) &&
    Boolean(v.age?.trim()) &&
    Boolean(v.employmentStatus?.trim()) &&
    Boolean(resolveProfileGoal(v))
  )
}

function firstIncompleteProfileStepIndex(v: Record<string, string>): number {
  for (let i = 0; i < PROFILE_QUESTIONS.length; i++) {
    const q = PROFILE_QUESTIONS[i]
    const raw = String(v[q.id] ?? '').trim()
    if (q.id === 'postcode') {
      if (raw.replace(/\s+/g, '').length < 4) return i
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
  const { refreshProfile, setLocationState } = useApp()
  
  const PROFILE_STEP_KEY = 'zz_profile_onboarding_step'
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
  const inputRef = useRef<HTMLInputElement>(null)
  const houseNumberRef = useRef<HTMLInputElement>(null)
  const hydratedRef = useRef(false)
  const [profileHydrated, setProfileHydrated] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [keyboardLift, setKeyboardLift] = useState(false)

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
    router.prefetch(ROUTES.PROFILE_SUMMARY)
  }, [router])

  useEffect(() => {
    submittingRef.current = false
    setIsSubmitting(false)
  }, [])

  useLayoutEffect(() => {
    if (hydratedRef.current || typeof window === 'undefined') return
    hydratedRef.current = true
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
      try {
        const raw = sessionStorage.getItem(PROFILE_STEP_KEY)
        const n = raw ? parseInt(raw, 10) : NaN
        if (Number.isFinite(n) && n >= 0 && n < PROFILE_QUESTIONS.length) {
          nextStep = n
        } else {
          const incomplete = firstIncompleteProfileStepIndex(
            Object.keys(stored).length > 0 ? stored : {}
          )
          if (incomplete >= 0) nextStep = incomplete
        }
      } catch {
        const incomplete = firstIncompleteProfileStepIndex(stored)
        if (incomplete >= 0) nextStep = incomplete
      }
    }
    setStep(nextStep)
    setProfileHydrated(true)
  }, [qParam, setStep])

  useEffect(() => {
    if (!profileHydrated) return
    if (!resolveProfileGoal(values)) {
      router.replace('/')
    }
  }, [profileHydrated, values, router])

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

  const current = PROFILE_QUESTIONS[step]
  const currentVal = values[current?.id] ?? ''

  useEffect(() => {
    const pc = (values.postcode ?? '').replace(/\s+/g, '').trim()
    if (pc.length < 4) return
    const houseNumber = (values.houseNumber ?? '').trim()
    const tid = window.setTimeout(() => {
      void resolveProfileLocalityForPostcode(pc)
        .then(({ label, source }) => {
          if (label && source !== 'postcode') persistProfileLocality(pc, label)
        })
        .catch(() => {})
      fetch('/api/local-intelligence', {
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
          if (!locationName) return
          persistProfileLocality(pc, locationName)
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
      const profileGoal = profileGoalField?.trim() || readStoredProfileGoal()
      const profileData = {
        home_type: profileHomeTypeField ?? undefined,
        home_power: profilePowerTypeField?.trim().toUpperCase() || undefined,
        heating: profileHomePowerToEnergyType(profilePowerTypeField) || undefined,
        transport_baseline: profileTransportField ?? undefined,
        household: profileLivingSituationField ?? undefined,
        employment_status: profileEmploymentStatusField ?? undefined,
        goal: profileGoal || undefined,
        primary_goal: profileGoal || undefined,
        house_number: profileHouseNumberField?.trim() || undefined,
      }
      const scrapeBody = {
        trigger: true,
        postcode: pc,
        profileData,
      }
      if (browserCanTriggerScrapeSync()) {
        void fetch('/api/scrape-sync', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...scrapeBody, category: 'home' }),
        }).catch(() => {})
        if (profilePowerTypeField?.trim()) {
          void fetch('/api/scrape-sync', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...scrapeBody, category: 'utilities' }),
          }).catch(() => {})
        }
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
        if (!resolveProfileGoal(mergedValues)) {
          router.replace('/')
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
          const pc = (mergedValues.postcode ?? '').replace(/\s+/g, '').trim()
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
        })()
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
      }

      void createUser(payload)
        .then((res) => {
          const userId = res?.user?.id ?? res?.id
          if (typeof window !== 'undefined' && userId) {
            localStorage.setItem('userId', String(userId))
            localStorage.setItem('user_id', String(userId))
            if (typeof res?.restore_proof === 'string' && res.restore_proof.trim()) {
              localStorage.setItem('zz_session_restore_proof', res.restore_proof.trim())
            }
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

  const readLiveFieldValue = useCallback(() => {
    if (current?.type === 'input' && inputRef.current) {
      return inputRef.current.value.trim()
    }
    return (values[current?.id ?? ''] ?? '').trim()
  }, [current, values])

  const handleNext = useCallback(() => {
    if (!current || submittingRef.current || isSubmitting) return
    const trimmed = readLiveFieldValue()
    if (current.type === 'input' && !trimmed) return
    inputRef.current?.blur()
    recenterProfileStep()
    advanceProfileStep({ ...values, [current.id]: trimmed })
  }, [current, values, isSubmitting, advanceProfileStep, readLiveFieldValue, recenterProfileStep])

  const handlePostcodeContinue = useCallback(() => {
    if (!current || current.id !== 'postcode' || submittingRef.current || isSubmitting) return
    const trimmedPc = (inputRef.current?.value ?? values.postcode ?? '').trim()
    if (trimmedPc.replace(/\s+/g, '').length < 4) return
    const trimmedHouse = (houseNumberRef.current?.value ?? values.houseNumber ?? '').trim()
    inputRef.current?.blur()
    houseNumberRef.current?.blur()
    recenterProfileStep()
    advanceProfileStep({
      ...values,
      postcode: trimmedPc.replace(/\s+/g, ' ').trim().toUpperCase(),
      houseNumber: trimmedHouse,
    })
  }, [current, values, isSubmitting, advanceProfileStep, recenterProfileStep])

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

    setValue(current.id, optValue)
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

  return (
    <main className={profileShellClass} style={profileShellStyle}>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="profile-step-slam w-full flex flex-col items-center"
          style={{ gap: 40, maxWidth: 520 }}
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
              maxWidth: 'min(92vw, 28rem)',
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
                  <label className="profile-optional-field-label zz-h4" htmlFor="profile-house-number">
                    house number <span className="profile-optional-suffix">(optional)</span>
                  </label>
                  <InputField
                    ref={houseNumberRef}
                    id="profile-house-number"
                    value={values.houseNumber ?? ''}
                    onChange={(v) => setValue('houseNumber', v)}
                    onAdvance={handlePostcodeContinue}
                    onFocusLift={liftProfileStepForKeyboard}
                    onBlurViewportReset={recenterProfileStep}
                    placeholder="e.g. 12"
                    autoComplete="address-line2"
                    name="house-number"
                    className="profile-house-number-input"
                  />
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
                disabled={isSubmitting}
                onClick={() => {
                  if (current.id === 'postcode') {
                    handlePostcodeContinue()
                    return
                  }
                  const trimmed = readLiveFieldValue()
                  if (!trimmed || isSubmitting) return
                  inputRef.current?.blur()
                  recenterProfileStep()
                  advanceProfileStep({ ...values, [current.id]: trimmed })
                }}
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
      </AnimatePresence>
    </main>
  )
}
