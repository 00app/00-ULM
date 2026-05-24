'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useApp } from '@/app/context/AppContext'
import ProfileAnswerBtn from '@/app/components/ui/ProfileAnswerBtn'
import { STACCATO_DURATION_SEC, STACCATO_DROP_PX, STACCATO_STAGGER_SEC, STACCATO_TWEEN } from '@/lib/animations'
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
import { PROFILE_GOAL_WEIGHTS, type ProfileGoalValue } from '@/lib/profile/goalWeighting'
import { syncSessionState } from '@/lib/sessionStateSync'
import { flushSync } from 'react-dom'

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
      { label: 'MIXED\nBOTH', value: 'MIX', ariaLabel: 'Mixed both — gas and electric' },
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
  {
    id: 'goal',
    label: 'what is your goal?',
    type: 'options' as const,
    options: (Object.keys(PROFILE_GOAL_WEIGHTS) as ProfileGoalValue[]).map((value) => ({
      label: PROFILE_GOAL_WEIGHTS[value].label,
      value,
      weighting: {
        money: PROFILE_GOAL_WEIGHTS[value].money,
        carbon: PROFILE_GOAL_WEIGHTS[value].carbon,
      },
      theme: PROFILE_GOAL_WEIGHTS[value].theme,
    })),
  },
]

const STORAGE_KEYS: Record<string, string> = {
  name: 'profile_name',
  postcode: 'profile_postcode',
  livingSituation: 'profile_household',
  homeType: 'profile_home_type',
  powerType: 'profile_home_power',
  transport: 'profile_transport',
  age: 'profile_age',
  employmentStatus: 'profile_employment_status',
  goal: 'profile_goal',
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
    Boolean(v.goal?.trim())
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
  const reduceMotion = useReducedMotion()
  const router = useRouter()
  const searchParams = useSearchParams()
  const qParam = searchParams?.get('q')
  const returnTo = searchParams?.get('returnTo')
  const { refreshProfile, setLocationState } = useApp()
  
  const PROFILE_STEP_KEY = 'zz_profile_onboarding_step'
  const [step, setStepState] = useState(() => {
    if (qParam) {
      const index = PROFILE_QUESTIONS.findIndex(
        (q) => q.id === qParam || (qParam === 'homePower' && q.id === 'powerType')
      )
      if (index !== -1) return index
    }
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem('zz_profile_onboarding_step')
        const n = raw ? parseInt(raw, 10) : 0
        if (Number.isFinite(n) && n >= 0 && n < PROFILE_QUESTIONS.length) return n
      } catch {
        // ignore
      }
    }
    return 0
  })
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
  const hydratedRef = useRef(false)
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {}
    const v: Record<string, string> = {}
    PROFILE_QUESTIONS.forEach((q) => {
      const val = localStorage.getItem(STORAGE_KEYS[q.id] ?? q.id)
      if (val) v[q.id] = val
    })
    return v
  })

  useLayoutEffect(() => {
    if (PROFILE_QUESTIONS.length === 0) return
    if (step < 0 || step >= PROFILE_QUESTIONS.length) setStep(0)
  }, [step])

  useEffect(() => {
    router.prefetch(ROUTES.PROFILE_SUMMARY)
  }, [router])

  useEffect(() => {
    submittingRef.current = false
    setIsSubmitting(false)
  }, [])

  useEffect(() => {
    if (hydratedRef.current || typeof window === 'undefined') return
    hydratedRef.current = true
    const stored: Record<string, string> = {}
    PROFILE_QUESTIONS.forEach((q) => {
      const val = localStorage.getItem(STORAGE_KEYS[q.id] ?? q.id)
      if (val) stored[q.id] = val
    })
    if (Object.keys(stored).length > 0) {
      setValues((prev) => ({ ...stored, ...prev }))
    }
  }, [])

  /** Mobile: recentre question block when the software keyboard dismisses. */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const vv = window.visualViewport
    const resetLayout = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
    const sync = () => {
      const gap = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0
      if (gap < 48) resetLayout()
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
  }, [step])

  const setValue = useCallback((id: string, value: string) => {
    if (id === 'postcode' && typeof window !== 'undefined') {
      const prev = (values.postcode ?? localStorage.getItem(STORAGE_KEYS.postcode) ?? '')
        .replace(/\s+/g, '')
        .trim()
        .toUpperCase()
      const next = value.replace(/\s+/g, '').trim().toUpperCase()
      if (prev.length >= 4 && next.length >= 4 && prev !== next) {
        clearZoneVmLocalCache({ preservePostcode: next })
      }
    }
    setValues((prev) => ({ ...prev, [id]: value }))
    const key = STORAGE_KEYS[id] ?? id
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value)
      if (id === 'powerType') persistHomePowerFromProfile(value)
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
        body: JSON.stringify({ postcode: pc }),
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
        })
        .catch(() => {})
    }, 150)
    return () => window.clearTimeout(tid)
  }, [values.postcode, setLocationState])

  useEffect(() => {
    const pc = (values.postcode ?? '').replace(/\s+/g, '').trim().toUpperCase()
    if (pc.length < 4) return
    const tid = window.setTimeout(() => {
      const profileData = {
        home_type: values.homeType ?? undefined,
        home_power: values.powerType?.trim().toUpperCase() || undefined,
        heating: profileHomePowerToEnergyType(values.powerType) || undefined,
        transport_baseline: values.transport ?? undefined,
        household: values.livingSituation ?? undefined,
        employment_status: values.employmentStatus ?? undefined,
        goal: values.goal ?? undefined,
        primary_goal: values.goal ?? undefined,
      }
      const scrapeBody = {
        trigger: true,
        postcode: pc,
        profileData,
      }
      void fetch('/api/scrape-sync', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scrapeBody, category: 'home' }),
      }).catch(() => {})
      if (values.powerType?.trim()) {
        void fetch('/api/scrape-sync', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...scrapeBody, category: 'utilities' }),
        }).catch(() => {})
      }
    }, 400)
    return () => window.clearTimeout(tid)
  }, [
    values.postcode,
    values.homeType,
    values.powerType,
    values.transport,
    values.livingSituation,
    values.employmentStatus,
  ])

  const submitProfile = useCallback(
    (finalValues: Record<string, string>, overrideReturnTo?: string) => {
      if (submittingRef.current) return
      let dest = overrideReturnTo || returnTo || ROUTES.PROFILE_SUMMARY
      dest = dest.trim()
      if (!dest.startsWith('http') && !dest.startsWith('/')) dest = `/${dest.replace(/^\/+/, '')}`
      if (!isProfileOnboardingComplete(finalValues)) {
        const idx = firstIncompleteProfileStepIndex(finalValues)
        if (idx >= 0) setStep(idx)
        return
      }

      submittingRef.current = true
      setIsSubmitting(true)

      if (typeof window !== 'undefined') {
        Object.entries(finalValues).forEach(([id, val]) => {
          const key = STORAGE_KEYS[id]
          if (key && typeof val === 'string' && val.trim()) {
            localStorage.setItem(key, val.trim())
          }
        })
        if (finalValues.powerType?.trim()) persistHomePowerFromProfile(finalValues.powerType)
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
          const pc = (finalValues.postcode ?? '').replace(/\s+/g, '').trim()
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
        name: finalValues.name ?? '',
        postcode: finalValues.postcode ?? '',
        household: finalValues.livingSituation ?? '',
        home_type: finalValues.homeType ?? '',
        transport: finalValues.transport ?? '',
        age_group: (finalValues.age as ProfileAge) ?? undefined,
        employment_status: finalValues.employmentStatus ?? undefined,
        goal: finalValues.goal ?? undefined,
      }

      void createUser(payload)
        .then((res) => {
          const userId = res?.user?.id ?? res?.id
          if (typeof window !== 'undefined' && userId) {
            localStorage.setItem('userId', String(userId))
            localStorage.setItem('user_id', String(userId))
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
            const locationName = formatLocationDisplayName(local, finalValues.postcode ?? '')
            if (locationName) {
              persistProfileLocality(finalValues.postcode ?? '', locationName)
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
    [refreshProfile, router, returnTo, setLocationState]
  )

  const persistStepValues = useCallback((nextValues: Record<string, string>) => {
    flushSync(() => {
      setValues((prev) => ({ ...prev, ...nextValues }))
      if (typeof window !== 'undefined') {
        Object.entries(nextValues).forEach(([id, val]) => {
          const key = STORAGE_KEYS[id] ?? id
          if (typeof val === 'string' && val.trim()) localStorage.setItem(key, val.trim())
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
    [step, returnTo, submitProfile, isSubmitting, persistStepValues]
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
    advanceProfileStep({ ...values, [current.id]: trimmed })
  }, [current, values, isSubmitting, advanceProfileStep, readLiveFieldValue])

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

  const questionBlockLabel = current ? current.label.replace(/\n/g, '\n') : ''
  /** Full-sentence headline + controls: one block fade (Mechanical Snap — not word-by-word). */
  const controlsAfterQuestionSec = STACCATO_DURATION_SEC + STACCATO_STAGGER_SEC

  const stepBlockInitial = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }
  const stepBlockAnimate = reduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }
  const stepBlockTransition = reduceMotion
    ? { duration: 0.12, ease: [0, 0.55, 0.45, 1] as const }
    : STACCATO_TWEEN
  const stepBlockExit = reduceMotion
    ? { opacity: 0, transition: { duration: 0.08, ease: [0, 0.55, 0.45, 1] as const } }
    : { opacity: 0, y: 8, transition: STACCATO_TWEEN }

  return (
    <main
      className="zz-profile-page"
      style={{
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
      }}
    >
      <>
        <motion.div
          key={step}
          className="profile-step-slam w-full flex flex-col items-center"
          style={{ gap: 40, maxWidth: 520 }}
          initial={stepBlockInitial}
          animate={stepBlockAnimate}
          exit={stepBlockExit}
          transition={stepBlockTransition}
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
            initial={reduceMotion ? false : { opacity: 0, y: STACCATO_DROP_PX }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0.12 } : STACCATO_TWEEN}
          >
            <span style={{ whiteSpace: 'pre-line', display: 'block' }}>{questionBlockLabel}</span>
          </motion.div>
          {current.type === 'input' ? (
            <div className="profile-step-controls profile-step-controls--input">
              <InputField
                ref={inputRef}
                value={currentVal}
                onChange={(v) => setValue(current.id, v)}
                onAdvance={handleNext}
                onBlurViewportReset={() => {
                  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
                }}
                placeholder={
                  (current as { label: string; placeholder?: string }).placeholder ?? current.label
                }
                autoFocus
              />
              <ProfileAnswerBtn
                reduceMotion={reduceMotion}
                optionIndex={0}
                delaySeconds={controlsAfterQuestionSec + STACCATO_STAGGER_SEC}
                className=""
                disabled={isSubmitting}
                onClick={() => {
                  const trimmed = readLiveFieldValue()
                  if (!trimmed || isSubmitting) return
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
                    delaySeconds={controlsAfterQuestionSec + optionIndex * STACCATO_STAGGER_SEC}
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
      </>
    </main>
  )
}
