'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useCallback, useEffect, useLayoutEffect, type CSSProperties } from 'react'
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
import type { LocalIntelligence } from '@/lib/local/getLocalData'
import { clearZoneVmLocalCache } from '@/lib/zone/clearZoneVmCache'
import { ensureClientResearchUserId, ensureGaryModeForPostcode } from '@/lib/zone/garyMode'

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
    options: [
      {
        label: 'SAVE',
        value: 'money',
        weighting: { money: 0.8, carbon: 0.2 },
        theme: 'var(--color-yellow)',
      },
      {
        label: 'REDUCE',
        value: 'carbon',
        weighting: { money: 0.2, carbon: 0.8 },
        theme: 'var(--color-pink)',
      },
      {
        label: 'BOTH',
        value: 'balanced',
        weighting: { money: 0.5, carbon: 0.5 },
        theme: 'var(--color-purple)',
      },
    ],
  },
]

const STORAGE_KEYS: Record<string, string> = {
  name: 'profile_name',
  postcode: 'profile_postcode',
  livingSituation: 'profile_household',
  homeType: 'profile_home_type',
  transport: 'profile_transport',
  age: 'profile_age',
  employmentStatus: 'profile_employment_status',
  goal: 'profile_goal',
}

export default function ProfilePageClient() {
  const reduceMotion = useReducedMotion()
  const router = useRouter()
  const searchParams = useSearchParams()
  const qParam = searchParams?.get('q')
  const returnTo = searchParams?.get('returnTo')
  const { refreshProfile, setLocationState } = useApp()
  
  const [step, setStep] = useState(() => {
    if (qParam) {
      const index = PROFILE_QUESTIONS.findIndex((q) => q.id === qParam)
      if (index !== -1) return index
    }
    return 0
  })
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

  const setValue = useCallback((id: string, value: string) => {
    if (id === 'postcode' && typeof window !== 'undefined') {
      const prev = (values.postcode ?? localStorage.getItem(STORAGE_KEYS.postcode) ?? '')
        .replace(/\s+/g, '')
        .trim()
        .toUpperCase()
      const next = value.replace(/\s+/g, '').trim().toUpperCase()
      if (prev.length >= 4 && next.length >= 4 && prev !== next) {
        clearZoneVmLocalCache({ preservePostcode: next })
      } else if (next.length >= 4) {
        ensureGaryModeForPostcode(next)
      }
    }
    setValues((prev) => ({ ...prev, [id]: value }))
    const key = STORAGE_KEYS[id] ?? id
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value)
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
      const researchUserId = ensureClientResearchUserId(pc)
      void fetch('/api/scrape-sync', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger: true,
          postcode: pc,
          category: 'home',
          ...(researchUserId ? { user_id: researchUserId } : {}),
          profileData: {
            home_type: values.homeType ?? undefined,
            transport_baseline: values.transport ?? undefined,
            household: values.livingSituation ?? undefined,
            employment_status: values.employmentStatus ?? undefined,
          },
        }),
      }).catch(() => {})
    }, 400)
    return () => window.clearTimeout(tid)
  }, [
    values.postcode,
    values.homeType,
    values.transport,
    values.livingSituation,
    values.employmentStatus,
  ])

  const submitProfile = useCallback(
    (finalValues: Record<string, string>, overrideReturnTo?: string) => {
      const dest = overrideReturnTo || returnTo || ROUTES.PROFILE_SUMMARY

      if (typeof window !== 'undefined') {
        Object.entries(finalValues).forEach(([id, val]) => {
          const key = STORAGE_KEYS[id]
          if (key && typeof val === 'string' && val.trim()) {
            localStorage.setItem(key, val.trim())
          }
        })
        try {
          persistUnifiedUserProfileMemory()
        } catch {
          // ignore
        }
        ensureClientResearchUserId(finalValues.postcode)
      }

      refreshProfile()
      router.push(dest)

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
            if (locationName) setLocationState({ locationName, local })
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
    },
    [refreshProfile, router, returnTo, setLocationState]
  )

  const handleNext = useCallback(() => {
    if (returnTo) {
      submitProfile(values, returnTo)
    } else if (step < PROFILE_QUESTIONS.length - 1) {
      setStep((s) => s + 1)
    } else {
      submitProfile(values)
    }
  }, [step, values, submitProfile, returnTo])

  if (!current) return null

  const handleOptionClick = (opt: any) => {
    const isObj = typeof opt === 'object' && opt !== null
    const optValue = isObj ? opt.value : opt
    setValue(current.id, optValue)
    
    if (returnTo) {
      const finalValues = { ...values, [current.id]: optValue }
      if (typeof window !== 'undefined') {
        const key = STORAGE_KEYS[current.id] ?? current.id
        localStorage.setItem(key, optValue)
      }
      submitProfile(finalValues, returnTo)
    } else if (step < PROFILE_QUESTIONS.length - 1) {
      setStep((s) => s + 1)
    } else {
      const finalValues = { ...values, [current.id]: optValue }
      if (typeof window !== 'undefined') {
        const key = STORAGE_KEYS[current.id] ?? current.id
        localStorage.setItem(key, optValue)
      }
      submitProfile(finalValues)
    }
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
        height: '100dvh',
        maxHeight: '100dvh',
        minHeight: 0,
        overflow: 'hidden',
        boxSizing: 'border-box',
        padding: 'clamp(20px, 3vw, 40px)',
        paddingTop: 'clamp(20px, 3vw, 40px)',
        paddingBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
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
            <div
              style={{
                width: '100%',
                maxWidth: 360,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 20,
              }}
            >
              <InputField
                value={currentVal}
                onChange={(v) => setValue(current.id, v)}
                onAdvance={handleNext}
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
                disabled={!currentVal.trim()}
                onClick={() => {
                  if (!currentVal.trim()) return
                  handleNext()
                }}
                aria-label="Continue"
              >
                <span className="profile-answer-btn__text zz-h4">CONTINUE</span>
              </ProfileAnswerBtn>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 16,
                justifyContent: 'center',
                maxWidth: 360,
              }}
            >
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
