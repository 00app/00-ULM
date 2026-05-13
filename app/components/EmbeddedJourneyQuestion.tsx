'use client'

/**
 * Embedded question chamber for Solo Focus (journey card + zip-shut overlay).
 * Split from JourneyBentoCard so SoloFocusOverlay does not import the whole card module
 * (avoids heavy coupling / init-order issues in production bundles).
 *
 * **Intelligence loop (journey MC / numeric answers):** `runSubmit` → `POST /api/answers` (auth) runs the
 * discovery race + Neon persistence server-side; JSON may include `discovery.new_card_data` and/or
 * `grid_pulse_card`. Those objects are passed to `injectNewDiscoveryCard` after a double rAF so the Zone
 * grid receives the birth event. **`POST /api/research/question-card`** is the separate free-form Ask path,
 * not invoked here.
 */
import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { JOURNEYS, FUNKY_QUESTION_LABEL, getOptionFullLabel, type JourneyId, type JourneyQuestion } from '@/lib/journeys'
import { getNextQuestion } from '@/lib/zone/questionHandler'
import { useApp } from '@/app/context/AppContext'
import { persistUnifiedUserProfileMemory } from '@/lib/unifiedProfileMemory'
import { syncSessionState } from '@/lib/sessionStateSync'
import {
  ELASTIC_PING,
  SPRING_BLOOM,
  SPRING_TAP,
  SHIMMER_FOCUS,
  INTRO_DECISION_CTA_TRANSITION,
  SOLO_FOCUS_MAX_QUESTIONS_PER_SESSION,
  SOLO_FOCUS_ZIP_SHUT_SEC,
  STACCATO_TWEEN,
  STACCATO_DROP_PX,
} from '@/lib/animations'
import { injectNewDiscoveryCard } from '@/lib/discoveryInject'
import type { SentinelMotherRecardPayload } from '@/lib/sentinel/recardTypes'

const ANSWER_COMMITTED_EVENT = 'zz_answer_committed'

/** Let the zip-shutter paint before the Zone grid receives the new card (mechanical handoff). */
function flushLayoutThenInject(card: unknown): void {
  if (typeof window === 'undefined') return
  requestAnimationFrame(() => {
    requestAnimationFrame(() => injectNewDiscoveryCard(card))
  })
}

/** Outside component so react-hooks/purity does not treat timestamp reads as render-phase impurity. */
function answerCommitTimestampMs(): number {
  return Date.now()
}

/** Merge API + generate-next morph lists without duplicate ids. */
function mergeMorphCardLists(server: unknown[] | undefined, client: unknown[] | undefined): any[] {
  const a = Array.isArray(server) ? server : []
  const b = Array.isArray(client) ? client : []
  const seen = new Set<string>()
  const out: any[] = []
  for (const raw of [...a, ...b]) {
    if (!raw || typeof raw !== 'object') continue
    const c = raw as { id?: unknown }
    const id = typeof c.id === 'string' ? c.id : ''
    if (id) {
      if (seen.has(id)) continue
      seen.add(id)
    }
    out.push(raw)
  }
  return out
}

function soloFocusQuestionCountStorageKey(sessionLaneKey: string | undefined, journeyId: JourneyId) {
  return `zz_sf_q_${sessionLaneKey ?? journeyId}`
}

function readSoloFocusAnswerCountForSession(key: string): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = sessionStorage.getItem(key)
    if (raw == null || raw === '') return 0
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

/** Solo-focus dropdown: same style as zz-input, purple/yellow, Marvin H4, full words, open animation */
const DROPDOWN_STYLE = {
  fontFamily: 'var(--font-marvin)',
  fontWeight: 700,
  fontSize: 'var(--zz-h4-mobile)',
  padding: '14px 20px',
  borderRadius: 40,
  minWidth: 200,
  maxWidth: 360,
  width: '100%',
} as const

/**
 * Solo Focus (zip-shut) uses **100px circles only** — no `<input>` fields in expanded view.
 * Values are coarse bands that `lib/brains/calculations.ts` accepts via `Number(...)`.
 */
function getSoloFocusNumberPresets(questionId: string): { label: string; value: string }[] {
  switch (questionId) {
    case 'monthly_cost':
      return [
        { label: '£80', value: '80' },
        { label: '£120', value: '120' },
        { label: '£180', value: '180' },
        { label: '£260', value: '260' },
      ]
    case 'distance_amount':
      return [
        { label: '10MI', value: '10' },
        { label: '25MI', value: '25' },
        { label: '50MI', value: '50' },
        { label: '80MI', value: '80' },
      ]
    case 'monthly_spend':
      return [
        { label: '£80', value: '80' },
        { label: '£150', value: '150' },
        { label: '£250', value: '250' },
        { label: '£400', value: '400' },
      ]
    default:
      return [
        { label: '50', value: '50' },
        { label: '100', value: '100' },
        { label: '200', value: '200' },
        { label: '350', value: '350' },
      ]
  }
}

/** Number-type question: input + submit — used only outside Solo Focus zip-shut (e.g. future settings). */
function NumberQuestionInput({
  firstUnanswered,
  onSubmit,
  restBg,
  restText,
  activeBg,
  activeText,
  triggerHaptic,
  alignStart,
}: {
  firstUnanswered: JourneyQuestion
  onSubmit: (value: string) => void
  restBg: string
  restText: string
  activeBg: string
  activeText: string
  triggerHaptic: (p: 'light' | 'medium' | 'heavy') => void
  alignStart?: boolean
}) {
  const [value, setValue] = useState('')
  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    triggerHaptic('medium')
    onSubmit(trimmed)
    setValue('')
  }
  const placeholder = firstUnanswered.repeatLabel ?? firstUnanswered.label
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 360,
        display: 'flex',
        flexDirection: 'column',
        alignItems: alignStart ? 'flex-start' : 'center',
        gap: 12,
      }}
    >
      <input
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        style={{
          ...DROPDOWN_STYLE,
          border: `2px solid var(--color-purple)`,
          background: restBg,
          color: restText,
          outline: 'none',
        }}
      />
      <motion.button
        type="button"
        onClick={handleSubmit}
        disabled={!value.trim()}
        style={{
          ...DROPDOWN_STYLE,
          border: 'none',
          cursor: value.trim() ? 'pointer' : 'not-allowed',
          background: value.trim() ? activeBg : 'var(--color-purple)',
          color: activeText,
          opacity: value.trim() ? 1 : 0.7,
        }}
        whileTap={value.trim() ? { scale: 0.98 } : {}}
        transition={SPRING_TAP}
      >
        Save
      </motion.button>
    </div>
  )
}

/** Circle button style for expanded card options — matches --solo-focus-answer-chip in globals.css */
const ANSWER_CIRCLE_STYLE = {
  width: 'var(--solo-focus-answer-chip)',
  height: 'var(--solo-focus-answer-chip)',
  minWidth: 'var(--solo-focus-answer-chip)',
  minHeight: 'var(--solo-focus-answer-chip)',
  borderRadius: 9999,
  border: 'none',
  cursor: 'pointer' as const,
  display: 'flex',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  flexShrink: 0,
}

const ZIP_SHUTTER_SPRING = {
  type: 'tween' as const,
  duration: SOLO_FOCUS_ZIP_SHUT_SEC,
  ease: [0.33, 1, 0.68, 1] as const,
}

export function EmbeddedJourneyQuestion({
  journeyId,
  onClose,
  onJourneyAnswered,
  textColor,
  triggerHaptic,
  soloFocusZipShut,
  onSoloEmbedComplete,
  onSoloFocusPostSuccess,
  onSourceCitation,
  onActiveQuestionLabelChange,
  onZipShutStart,
  onZipShutEnd,
  deferJourneyAnsweredForZipRebirth = false,
  layoutAlign = 'start',
  sessionLaneKey,
}: {
  journeyId: JourneyId
  onClose?: () => void
  onJourneyAnswered?: () => void
  textColor?: string
  triggerHaptic: (p: 'light' | 'medium' | 'heavy') => void
  /** Fired when the visible embed question label changes (for Ask Zai context). */
  onActiveQuestionLabelChange?: (label: string | null) => void
  /** `start` = industrial left rail (Solo Focus); `center` = legacy centered block */
  layoutAlign?: 'start' | 'center'
  /** One answer → close overlay, refresh Zone, scroll to card */
  soloFocusZipShut?: boolean
  onSoloEmbedComplete?: () => void
  /** After POST /api/answers OK: discovery JSON + swap to RESULT (Solo Focus). */
  onZipShutStart?: () => void
  onZipShutEnd?: (postOk: boolean) => void
  /** When true with `soloFocusZipShut`, skip immediate `onJourneyAnswered` so the parent can fire it mid zip-rebirth (after shut, before open). */
  deferJourneyAnsweredForZipRebirth?: boolean
  onSoloFocusPostSuccess?: (payload: {
    questionId: string
    answerValue: string
    discovery_win?: string
    grid_context?: {
      intensity_g_per_kwh?: number | null
      cleaner_vs_2025_pct?: number | null
    }
    grid_pulse_card?: unknown
    new_discovery_card?: {
      id: string
      title: string
      value: string
      journey_key: string
      source_url: string
      nested_question_id: string | null
    }
    discovery?: {
      recommendation_copy?: string
      source_url?: string
      new_card_data?: unknown
    }
    morphCards?: any[]
    userContext?: any
    researchAttribution?: { headline?: string | null; supplied_by?: string | null } | null
    /** Snapshot for session reload — same payload parent shows in Source footer. */
    sourceCitation?: { label: string; url?: string; verifiedAt?: string }
    /** When true, parent keeps QUESTION rail for the next step after rebirth (infinite loop). */
    hasNextQuestion?: boolean
    /** Updated totals for live hero count-up during zip morph. */
    newTotals?: { totalMoney: number; totalCarbon: number }
    /** v5.9 — Sentinel Mother deck recard (home lane). */
    sentinelMotherRefresh?: SentinelMotherRecardPayload | null
  }) => void
  /** Latest research citation from `research_results` (after POST /api/answers returns). */
  onSourceCitation?: (citation: { label: string; url?: string; verifiedAt?: string }) => void
  /**
   * Solo Focus session scope for lane-lock (immutable `journeyId` while this surface is open).
   * Defaults to `journey_${journeyId}` when omitted.
   */
  sessionLaneKey?: string
}) {
  const reduceMotion = useReducedMotion()
  const { setHeroTotals, state, refreshProfile } = useApp()
  const profile = state.profile
  const def = JOURNEYS[journeyId]
  const questions = def?.questions ?? []
  const storageKey = `journey_${journeyId}_answers`
  const [submitted, setSubmitted] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [mounted, setMounted] = useState(false)
  const isMountedRef = useRef(true)
  const [swishingOption, setSwishingOption] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(storageKey) || '{}'
      setAnswers(JSON.parse(raw) as Record<string, string>)
    } catch {
      setAnswers({})
    }
  }, [mounted, storageKey, submitted])

  const firstUnanswered = getNextQuestion(journeyId, answers)
  const selectedOption = firstUnanswered ? answers[firstUnanswered.id] : undefined

  const isNumberQuestionEarly = firstUnanswered?.type === 'number'
  const hasOptionsEarly = (firstUnanswered?.options?.length ?? 0) > 0
  const activeQuestionLabelForZai =
    onJourneyAnswered &&
    !submitted &&
    firstUnanswered &&
    (isNumberQuestionEarly || hasOptionsEarly)
      ? questions[0] && firstUnanswered.id === questions[0].id
        ? (FUNKY_QUESTION_LABEL[journeyId] ?? firstUnanswered.label)
        : firstUnanswered.label
      : null

  useEffect(() => {
    onActiveQuestionLabelChange?.(activeQuestionLabelForZai)
  }, [activeQuestionLabelForZai, onActiveQuestionLabelChange])

  if (!onJourneyAnswered) return null
  if (!mounted) return <div style={{ minHeight: 120 }} aria-busy aria-label="Journey questions" />

  const runSubmit = async (value: string) => {
    if (!value.trim() || !firstUnanswered) return
    const trimmed = value.trim()
    const laneStorageKey = `zz_sf_lane_${sessionLaneKey ?? journeyId}`
    if (typeof window !== 'undefined') {
      try {
        const prevLane = sessionStorage.getItem(laneStorageKey)
        if (prevLane != null && prevLane !== journeyId) {
          return
        }
      } catch {
        /* ignore */
      }
    }
    const qCountKey = soloFocusQuestionCountStorageKey(sessionLaneKey, journeyId)
    if (soloFocusZipShut && typeof window !== 'undefined') {
      if (readSoloFocusAnswerCountForSession(qCountKey) >= SOLO_FOCUS_MAX_QUESTIONS_PER_SESSION) {
        return
      }
    }
    const obj = { ...answers, [firstUnanswered.id]: trimmed }

    const questionIdSnapshot = firstUnanswered.id
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(obj))
      } catch {
        // ignore storage failures
      }
      try {
        persistUnifiedUserProfileMemory()
      } catch {
        // ignore
      }
      refreshProfile()
      window.dispatchEvent(
        new CustomEvent(ANSWER_COMMITTED_EVENT, {
          detail: {
            journeyId,
            questionId: questionIdSnapshot,
            answerValue: trimmed,
            committedAt: answerCommitTimestampMs(),
          },
        })
      )
    }

    let allAnswers = {}
    if (typeof window !== 'undefined') {
      try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('journey_') && k.endsWith('_answers'))
        keys.forEach(k => {
          allAnswers = { ...allAnswers, ...JSON.parse(localStorage.getItem(k) || '{}') }
        })
      } catch {}
    }
    const userContext = {
      onboardingAnswers: profile,
      expandedViewAnswers: { ...allAnswers, [questionIdSnapshot]: trimmed },
      lastExpandedAnswer: {
        journey_key: journeyId,
        question_id: questionIdSnapshot,
        answer_value: trimmed,
      },
    }

    void fetch('/api/zone/generate-next', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: journeyId, userContext }),
    }).catch(() => {})

    onZipShutStart?.()
    const postPromise = fetch('/api/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        journey_key: journeyId,
        question_id: questionIdSnapshot,
        answer_value: trimmed,
      }),
      credentials: 'include',
    })
    let postOk = false
    try {
      const res = await postPromise

      /** Logged-out Zone: `/api/answers` is 401 — still run Solo Focus zip + morph from `/api/answers` payload + local answers. */
      const guestSoloFocusOk =
        !res.ok &&
        res.status === 401 &&
        Boolean(soloFocusZipShut && onSoloFocusPostSuccess)

      let data: Record<string, any> | null = null
      if (res.ok) {
        data = (await res.json().catch(() => ({}))) as Record<string, any>
      } else if (guestSoloFocusOk) {
        data = {}
      } else {
        return
      }

      postOk = true

      if (typeof window !== 'undefined') {
        try {
          if (sessionStorage.getItem(laneStorageKey) == null) {
            sessionStorage.setItem(laneStorageKey, journeyId)
          }
        } catch {
          /* ignore */
        }
      }

      // storage/profile already committed optimistically before network post
      if (data?.newTotals && typeof data.newTotals.totalMoney === 'number' && typeof data.newTotals.totalCarbon === 'number') {
        setHeroTotals({ totalMoney: data.newTotals.totalMoney, totalCarbon: data.newTotals.totalCarbon })
      }
      const discovery = data?.discovery as
        | {
            recommendation_copy?: string
            source_url?: string
            new_card_data?: unknown
          }
        | undefined
      const cite = data?.sourceCitation as { label?: string; url?: string; verifiedAt?: string } | undefined
      let sourceCitationForSnap: { label: string; url?: string; verifiedAt?: string } | undefined
      if (discovery?.source_url && typeof discovery.source_url === 'string') {
        const c = {
          label: 'Live recommendation',
          url: discovery.source_url,
          verifiedAt: typeof cite?.verifiedAt === 'string' ? cite.verifiedAt : undefined,
        }
        onSourceCitation?.(c)
        sourceCitationForSnap = c
      } else if (cite && typeof cite.label === 'string' && cite.label.trim()) {
        const c = {
          label: cite.label.trim(),
          url: typeof cite.url === 'string' ? cite.url : undefined,
          verifiedAt: typeof cite.verifiedAt === 'string' ? cite.verifiedAt : undefined,
        }
        onSourceCitation?.(c)
        sourceCitationForSnap = c
      }

      const zoneCard = discovery?.new_card_data
      if (zoneCard && typeof zoneCard === 'object' && zoneCard !== null && 'id' in zoneCard && typeof (zoneCard as { id: unknown }).id === 'string') {
        flushLayoutThenInject(zoneCard)
      }
      const pulse = data?.grid_pulse_card
      if (pulse && typeof pulse === 'object' && pulse !== null && 'id' in pulse && typeof (pulse as { id: unknown }).id === 'string') {
        flushLayoutThenInject(pulse)
      }

      if (typeof window !== 'undefined') {
        try {
          const completed = JSON.parse(localStorage.getItem('completedJourneys') || '[]') as string[]
          if (!completed.includes(journeyId)) {
            completed.push(journeyId)
            localStorage.setItem('completedJourneys', JSON.stringify(completed))
          }
        } catch {
          // ignore
        }
      }

      // Always update local question state immediately after a successful POST.
      // This prevents the same question from reappearing if parent RESULT state is delayed.
      setAnswers(obj)

      syncSessionState()
      triggerHaptic('medium')
      const nextQ = getNextQuestion(journeyId, obj)
      const prevQCount = soloFocusZipShut ? readSoloFocusAnswerCountForSession(qCountKey) : 0
      const nextQCount = soloFocusZipShut ? prevQCount + 1 : 0
      if (soloFocusZipShut && typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(qCountKey, String(nextQCount))
        } catch {
          /* ignore */
        }
      }
      const allowNextQuestion =
        Boolean(nextQ) &&
        (!soloFocusZipShut || nextQCount < SOLO_FOCUS_MAX_QUESTIONS_PER_SESSION)
      if (soloFocusZipShut) {
        if (!deferJourneyAnsweredForZipRebirth) {
          onJourneyAnswered?.()
        }
        onSoloEmbedComplete?.()
        if (onSoloFocusPostSuccess) {
          const serverMorph = data?.morphCards
          const morphMerged = mergeMorphCardLists(serverMorph, undefined)
          const ndc = data?.new_discovery_card as
            | {
                id?: string
                title?: string
                value?: string
                journey_key?: string
                source_url?: string
                nested_question_id?: string | null
              }
            | undefined
          const researchAttribution = data?.researchAttribution as
            | { headline?: string | null; supplied_by?: string | null }
            | undefined
          onSoloFocusPostSuccess({
            questionId: questionIdSnapshot,
            answerValue: trimmed,
            discovery,
            sentinelMotherRefresh:
              (data?.sentinelMotherRefresh as SentinelMotherRecardPayload | undefined) ?? null,
            discovery_win: typeof data?.discovery_win === 'string' ? data.discovery_win : undefined,
            grid_context: data?.grid_context as
              | { intensity_g_per_kwh?: number | null; cleaner_vs_2025_pct?: number | null }
              | undefined,
            grid_pulse_card: data?.grid_pulse_card,
            new_discovery_card:
              ndc && typeof ndc.id === 'string' && typeof ndc.title === 'string'
                ? {
                    id: ndc.id,
                    title: ndc.title,
                    value: typeof ndc.value === 'string' ? ndc.value : '',
                    journey_key: typeof ndc.journey_key === 'string' ? ndc.journey_key : '',
                    source_url: typeof ndc.source_url === 'string' ? ndc.source_url : '',
                    nested_question_id:
                      typeof ndc.nested_question_id === 'string' ? ndc.nested_question_id : null,
                  }
                : undefined,
            morphCards: morphMerged,
            userContext: userContext,
            researchAttribution: researchAttribution ?? undefined,
            sourceCitation: sourceCitationForSnap,
            hasNextQuestion: allowNextQuestion,
            newTotals:
              data?.newTotals &&
              typeof data.newTotals.totalMoney === 'number' &&
              typeof data.newTotals.totalCarbon === 'number'
                ? {
                    totalMoney: data.newTotals.totalMoney,
                    totalCarbon: data.newTotals.totalCarbon,
                  }
                : undefined,
          })
          return
        }
        /* Zip-shut without parent RESULT handler: refresh Zone, advance queue — do not close overlay */
        setAnswers(obj)
        if (isMountedRef.current) setSwishingOption(null)
        return
      }
      
      if (!nextQ) {
        if (onSoloFocusPostSuccess) {
           setSubmitted(true)
           const merged = mergeMorphCardLists(data?.morphCards, undefined)
           const researchAttribution = data?.researchAttribution as
             | { headline?: string | null; supplied_by?: string | null }
             | undefined
           onSoloFocusPostSuccess({
            questionId: questionIdSnapshot,
            answerValue: trimmed,
            discovery,
            sentinelMotherRefresh:
              (data?.sentinelMotherRefresh as SentinelMotherRecardPayload | undefined) ?? null,
            discovery_win: typeof data?.discovery_win === 'string' ? data.discovery_win : undefined,
            morphCards: merged,
            userContext: userContext,
            researchAttribution: researchAttribution ?? undefined,
            sourceCitation: sourceCitationForSnap,
            hasNextQuestion: false,
            newTotals:
              data?.newTotals &&
              typeof data.newTotals.totalMoney === 'number' &&
              typeof data.newTotals.totalCarbon === 'number'
                ? {
                    totalMoney: data.newTotals.totalMoney,
                    totalCarbon: data.newTotals.totalCarbon,
                  }
                : undefined,
          })
        } else {
          onClose?.()
          setSubmitted(true)
        }
      }
      
      onJourneyAnswered()
    } catch {
      // leave UI unchanged on error
    } finally {
      onZipShutEnd?.(postOk)
      if (isMountedRef.current) {
        window.setTimeout(() => {
          if (isMountedRef.current) setSwishingOption(null)
        }, 90)
      }
    }
  }

  const handleEmbedSubmit = (value: string) => {
    if (!value.trim() || !firstUnanswered) return
    if (swishingOption !== null) return
    setSwishingOption(value)
    void runSubmit(value)
  }

  const messageColor = textColor ?? 'var(--color-purple)'

  const isNumberQuestion = firstUnanswered ? firstUnanswered.type === 'number' : false
  const hasOptions = (firstUnanswered?.options?.length ?? 0) > 0

  const questionLabel =
    questions[0] && firstUnanswered?.id === questions[0].id
      ? (FUNKY_QUESTION_LABEL[journeyId] ?? (firstUnanswered?.label ?? ''))
      : (firstUnanswered?.label ?? '')

  const restBg = 'var(--color-pink)'
  const restText = 'var(--color-yellow)'
  const activeBg = 'var(--color-purple)'
  const activeText = 'var(--color-yellow)'
  const toChipLabel = (opt: string) =>
    getOptionFullLabel(opt).replace(/\s+/g, '').toUpperCase()

  const isSwishing = swishingOption !== null

  const railAlign = layoutAlign === 'start'
  const showResultCopy = submitted || !firstUnanswered || (!isNumberQuestion && !hasOptions)
  if (showResultCopy) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="zip-result"
          initial={{ height: 0, scaleY: 0, opacity: 1 }}
          animate={{ height: 'auto', scaleY: 1, opacity: 1 }}
          exit={{ height: 0, scaleY: 0, opacity: 1 }}
          transition={ZIP_SHUTTER_SPRING}
          style={{ width: '100%', transformOrigin: railAlign ? 'left top' : 'center top', overflow: 'hidden' }}
        >
          <p
            className={`zz-body-bold mt-6 ${layoutAlign === 'start' ? 'text-left' : 'text-center'}`}
            style={{ color: messageColor }}
          >
            All set for this journey.
          </p>
        </motion.div>
      </AnimatePresence>
    )
  }
  return (
    <motion.div
      className={`flex flex-col ${railAlign ? 'items-start justify-start' : 'items-center justify-center'} gap-4 sm:gap-6 w-full pt-0 pb-0`}
      style={{ transformOrigin: railAlign ? 'left top' : 'center top' }}
      variants={{
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: SPRING_BLOOM },
      }}
      initial={{ height: 'auto', scaleY: 1, opacity: 1 }}
      animate={{
        height: isSwishing ? 0 : 'auto',
        opacity: 1,
        scaleY: isSwishing ? 0 : 1,
        transition: ZIP_SHUTTER_SPRING,
      }}
    >
      <AnimatePresence mode="wait">
        <motion.h3
          key={questionLabel}
          className={`solo-focus-question-label solo-focus-copy-width text-marvin uppercase zz-h3 ${
            soloFocusZipShut ? '' : 'zz-shimmer-focus'
          } ${railAlign ? 'text-left' : 'text-center'}`}
          style={{
            margin: 0,
            fontFamily: 'var(--font-marvin)',
            fontWeight: 700,
            color: textColor ?? 'var(--color-purple)',
            willChange: soloFocusZipShut ? 'opacity, transform' : 'filter, transform',
          }}
          initial={
            reduceMotion
              ? false
              : soloFocusZipShut
                ? { opacity: 0, y: STACCATO_DROP_PX }
                : SHIMMER_FOCUS.initial
          }
          animate={
            reduceMotion
              ? { opacity: 1, filter: 'none', scale: 1 }
              : soloFocusZipShut
                ? { opacity: 1, y: 0, transition: STACCATO_TWEEN }
                : SHIMMER_FOCUS.animate
          }
          exit={
            reduceMotion
              ? { opacity: 0 }
              : soloFocusZipShut
                ? { opacity: 0, y: 6, transition: { duration: 0.12, ease: [0, 0.55, 0.45, 1] as const } }
                : { ...SHIMMER_FOCUS.initial, transition: { duration: 0.12 } }
          }
          transition={soloFocusZipShut ? undefined : SHIMMER_FOCUS.transition}
        >
          {questionLabel}
        </motion.h3>
      </AnimatePresence>

      {isNumberQuestion ? (
        soloFocusZipShut ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              columnGap: 16,
              rowGap: 16,
              justifyContent: railAlign ? 'flex-start' : 'center',
              maxWidth: railAlign ? '100%' : 302,
            }}
          >
            {getSoloFocusNumberPresets(firstUnanswered.id).map(({ label, value }, idx) => {
              const isThisSwishing = swishingOption === value
              return (
                <motion.button
                  key={value}
                  type="button"
                  aria-label={label}
                  className="solo-focus-answer-option answer-circle-100 zz-shimmer-focus"
                  onClick={() => handleEmbedSubmit(value)}
                  style={{
                    ...ANSWER_CIRCLE_STYLE,
                    background: restBg,
                    color: restText,
                    willChange: 'filter, transform',
                  }}
                  initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
                  animate={{
                    scale: isThisSwishing ? 0.5 : 1,
                    opacity: 1,
                    transition: ELASTIC_PING.transition,
                  }}
                  whileTap={!isSwishing ? { scale: 0.96 } : {}}
                  transition={{
                    ...INTRO_DECISION_CTA_TRANSITION,
                    delay: reduceMotion ? 0 : (idx + 1) * 0.1,
                  }}
                >
                  {label.replace(/\s+/g, '').toUpperCase()}
                </motion.button>
              )
            })}
          </div>
        ) : (
          <NumberQuestionInput
            firstUnanswered={firstUnanswered}
            onSubmit={(v) => handleEmbedSubmit(v)}
            restBg={restBg}
            restText={restText}
            activeBg={activeBg}
            activeText={activeText}
            triggerHaptic={triggerHaptic}
            alignStart={railAlign}
          />
        )
      ) : (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            columnGap: 16,
            rowGap: 16,
            justifyContent: railAlign ? 'flex-start' : 'center',
            maxWidth: railAlign ? '100%' : 302,
          }}
        >
          {firstUnanswered.options!.map((opt, idx) => {
            const isSelected = selectedOption === opt
            const isThisSwishing = swishingOption === opt
            const isDense = firstUnanswered.options!.length > 6
            const circleClass = isDense ? 'answer-circle-80' : 'answer-circle-100'
            const circleStyle = isDense
              ? {
                  width: 80,
                  height: 80,
                  fontSize: 'var(--zz-h4-mobile)',
                  fontFamily: 'var(--font-marvin)',
                  fontWeight: 700,
                  lineHeight: 'var(--zz-lh-heading)',
                }
              : {
                  ...ANSWER_CIRCLE_STYLE,
                  fontSize: 'var(--zz-h4-mobile)',
                  fontFamily: 'var(--font-marvin)',
                  fontWeight: 700,
                  lineHeight: 'var(--zz-lh-heading)',
                }
            return (
              <motion.button
                key={opt}
                type="button"
                aria-label={opt}
                className={`solo-focus-answer-option zz-shimmer-focus ${circleClass}`}
                onClick={() => handleEmbedSubmit(opt)}
                style={{
                  ...circleStyle,
                  background: isSelected ? activeBg : restBg,
                  color: isSelected ? activeText : restText,
                  willChange: 'filter, transform',
                }}
                initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
                animate={{
                  scale: isThisSwishing ? 0.5 : 1,
                  opacity: 1,
                  transition: ELASTIC_PING.transition,
                }}
                whileTap={!isSwishing ? { scale: 0.96 } : {}}
                transition={{
                  ...INTRO_DECISION_CTA_TRANSITION,
                  delay: reduceMotion ? 0 : (idx + 1) * 0.1,
                }}
              >
                {toChipLabel(opt)}
              </motion.button>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
