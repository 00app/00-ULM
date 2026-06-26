'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { JourneyId } from '@/lib/journeys'
import { loopQuestionDisplayText, pickNextLoopQuestion } from '@/lib/zone/loopQuestions'
import {
  buildAchievementDiscoveryCard,
  injectNewDiscoveryCard,
  persistAchievementCardRemote,
} from '@/lib/discoveryInject'
import { persistLoopAnswerLocal, markLoopDoneForJourney } from '@/lib/zone/loopMemory'
import { authenticatedPost } from '@/lib/client/authenticatedFetch'
import {
  fetchTier2ScrapeSync,
  refreshZoneTotalsAfterTier2,
} from '@/lib/zone/tier2RecursiveSpawner'
import { triggerScrapeSyncForCategory } from '@/lib/researchSyncClient'
import { getDiscoveryRecommendation } from '@/lib/brains/recommendations'
import {
  formatZoneCategoryLabel,
  headlineFromTitle,
  MAX_ZONE_CARD_HEADLINE_WORDS,
} from '@/lib/soloFocusCopy'
import ProfileAnswerBtn from '@/app/components/ui/ProfileAnswerBtn'
import { ArchitecturalPulse } from '@/app/components/ArchitecturalPulse'
import { CLEAN_BIRTH_PULSE_MAX_WAIT_MS, CLEAN_BIRTH_PULSE_WORDS } from '@/lib/architecturalPulse'
import type { ZoneTipCard } from '@/lib/logic/zone'
import {
  familyControlDelaySec,
  familyProfileStepProps,
  FAMILY_DUR_ATOMIC,
  FAMILY_TRANSITION_ATOMIC,
} from '@/lib/motion-family'

const TIER2_ENRICH_TIMEOUT_MS = 8000

type TakeoverPhase = 'question' | 'pulse' | 'exit'

type Props = {
  open: boolean
  journeyId: JourneyId
  postcode: string | null | undefined
  profileData?: {
    postcode?: string
    home_type?: string | null
    transport_baseline?: string | null
    household?: string | null
    employment_status?: string | null
  }
  onRevealComplete: () => void
  onAchievementCard?: (card: ZoneTipCard) => void
}

function capTier2Fetch(
  params: Parameters<typeof fetchTier2ScrapeSync>[0]
): Promise<Awaited<ReturnType<typeof fetchTier2ScrapeSync>>> {
  return Promise.race([
    fetchTier2ScrapeSync(params),
    new Promise<Awaited<ReturnType<typeof fetchTier2ScrapeSync>>>((resolve) => {
      window.setTimeout(
        () =>
          resolve({
            ok: false,
            category: params.category,
            coverage: null,
            meta: null,
            morphCard: null,
            offerUrl: null,
          }),
        TIER2_ENRICH_TIMEOUT_MS
      )
    }),
  ])
}

function birthAchievementCard(
  params: {
    journeyId: JourneyId
    questionId: string
    answerValue: string
    title: string
    body: string
    offerUrl: string | null
  },
  onAchievementCard?: (card: ZoneTipCard) => void
) {
  const card = injectNewDiscoveryCard(
    buildAchievementDiscoveryCard({
      journeyId: params.journeyId,
      questionId: params.questionId,
      answerValue: params.answerValue,
      title: params.title,
      body: params.body,
      offerUrl: params.offerUrl,
    })
  )
  if (card) {
    onAchievementCard?.(card)
    persistAchievementCardRemote(card, {
      journeyId: params.journeyId,
      questionId: params.questionId,
      answerValue: params.answerValue,
    })
  }
  return card
}

export function DiscoveryTakeover({
  open,
  journeyId,
  postcode,
  profileData,
  onRevealComplete,
  onAchievementCard,
}: Props) {
  const reduceMotion = useReducedMotion()
  const beat = useMemo(() => {
    if (!open) return null
    return pickNextLoopQuestion(journeyId)
  }, [open, journeyId])
  const [phase, setPhase] = useState<TakeoverPhase>('question')
  const [answerLocked, setAnswerLocked] = useState(false)
  const [pulseWordsComplete, setPulseWordsComplete] = useState(false)
  const [cardReady, setCardReady] = useState(false)
  const revealFiredRef = useRef(false)

  useEffect(() => {
    if (!open) {
      setPhase('question')
      setAnswerLocked(false)
      setPulseWordsComplete(false)
      setCardReady(false)
      revealFiredRef.current = false
      return
    }
    if (!beat) {
      onRevealComplete()
    }
  }, [open, beat, onRevealComplete])

  const runCleanBirthLabor = useCallback(
    async (answerValue: string) => {
      if (!beat) return
      try {
        const pc = String(postcode ?? profileData?.postcode ?? '')
          .replace(/\s+/g, '')
          .trim()
          .toUpperCase()

        persistLoopAnswerLocal({
          journeyId,
          questionId: beat.questionId,
          answer: answerValue,
        })
        markLoopDoneForJourney(journeyId)
        const { ensureProfileSession } = await import('@/lib/client/ensureProfileSession')
        await ensureProfileSession()
        const rec = getDiscoveryRecommendation(journeyId, beat.questionId, answerValue)
        const fallbackTitle = headlineFromTitle(rec.headline || rec.body, MAX_ZONE_CARD_HEADLINE_WORDS)
        const fallbackUrl = rec.actionUrl ?? rec.learnUrl ?? rec.ctaUrl ?? null

        let serverCard: ZoneTipCard | null = null
        try {
          const answersRes = await authenticatedPost('/api/answers', {
            journey_key: journeyId,
            question_id: beat.questionId,
            answer_value: answerValue,
            postcode: pc || undefined,
            solo_focus: true,
          })
          if (answersRes.ok) {
            const data = (await answersRes.json()) as {
              discovery?: { new_card_data?: unknown }
              grid_pulse_card?: unknown
            }
            const raw = data.discovery?.new_card_data ?? data.grid_pulse_card
            if (raw) {
              const injected = injectNewDiscoveryCard(raw)
              if (injected) serverCard = injected
            }
          }
        } catch {
          /* fall back to client recommendation */
        }

        const optimistic =
          serverCard ??
          birthAchievementCard(
            {
              journeyId,
              questionId: beat.questionId,
              answerValue,
              title: fallbackTitle,
              body: rec.body,
              offerUrl: fallbackUrl,
            },
            onAchievementCard
          )
        if (serverCard) onAchievementCard?.(serverCard)
        if (optimistic) setCardReady(true)

        if (pc.length >= 4 && !serverCard) {
          triggerScrapeSyncForCategory({
            postcode: pc,
            category: journeyId,
            profileData: profileData ?? { postcode: pc },
            lifestyleShift: true,
            isAchievementCard: true,
            questionId: beat.questionId,
            answerValue,
            bestOfferHint: `Lifestyle shift. User answered: ${answerValue}. Prioritise rail vs flight, EV swap, local holidays — not generic homepages.`,
          })
          void (async () => {
            try {
              const tier2 = await capTier2Fetch({
                postcode: pc,
                category: journeyId,
                answer: answerValue,
                questionId: beat.questionId,
              })
              if (!tier2.ok && !tier2.morphCard?.title?.trim()) return
              const enrichedTitle =
                tier2.morphCard?.title?.trim() ||
                headlineFromTitle(rec.headline || rec.body, MAX_ZONE_CARD_HEADLINE_WORDS)
              birthAchievementCard(
                {
                  journeyId,
                  questionId: beat.questionId,
                  answerValue,
                  title: enrichedTitle,
                  body: rec.body,
                  offerUrl:
                    tier2.offerUrl ??
                    tier2.morphCard?.cta?.url ??
                    tier2.morphCard?.actions?.learnUrl ??
                    fallbackUrl,
                },
                onAchievementCard
              )
              void refreshZoneTotalsAfterTier2(pc)
            } catch {
              /* tier-2 optional */
            }
          })()
        }

        if (!optimistic) setCardReady(true)
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[DiscoveryTakeover] clean birth failed', err)
        }
        setCardReady(true)
      }
    },
    [postcode, profileData, journeyId, beat, onAchievementCard]
  )

  const tryReveal = useCallback(() => {
    if (revealFiredRef.current) return
    if (!cardReady || !pulseWordsComplete) return
    revealFiredRef.current = true
    setPhase('exit')
  }, [cardReady, pulseWordsComplete])

  useEffect(() => {
    if (phase !== 'exit') return
    const ms = reduceMotion === true ? 150 : Math.round(FAMILY_DUR_ATOMIC * 1000)
    const t = window.setTimeout(() => onRevealComplete(), ms)
    return () => window.clearTimeout(t)
  }, [phase, onRevealComplete, reduceMotion])

  useEffect(() => {
    if (phase !== 'pulse' || !pulseWordsComplete || !cardReady) return
    tryReveal()
  }, [phase, pulseWordsComplete, cardReady, tryReveal])

  useEffect(() => {
    if (phase !== 'pulse') return
    const safety = window.setTimeout(() => {
      if (!revealFiredRef.current) setCardReady(true)
    }, CLEAN_BIRTH_PULSE_MAX_WAIT_MS)
    return () => window.clearTimeout(safety)
  }, [phase])

  const handleAnswer = useCallback(
    (answerValue: string) => {
      if (answerLocked || !beat) return
      setAnswerLocked(true)
      void runCleanBirthLabor(answerValue)
      setPhase('pulse')
    },
    [answerLocked, runCleanBirthLabor, beat]
  )

  if (!open || !beat || typeof document === 'undefined') return null

  const zoneCategoryLabel = formatZoneCategoryLabel(String(journeyId || 'home'))
  const motionSafe = reduceMotion === true
  const stepMotion = familyProfileStepProps(motionSafe)
  const controlsAfterQuestionSec = familyControlDelaySec(0, 0.12)
  const shellExiting = phase === 'exit'

  return createPortal(
    <motion.main
      className="discovery-clean-birth zone-loop-takeover"
      role="dialog"
      aria-modal
      aria-labelledby="discovery-takeover-question"
      initial={stepMotion.initial}
      animate={shellExiting ? stepMotion.exit : stepMotion.animate}
      transition={FAMILY_TRANSITION_ATOMIC}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 220,
        height: '100dvh',
        maxHeight: '100dvh',
        minHeight: 0,
        overflow: 'hidden',
        boxSizing: 'border-box',
        padding: 'clamp(20px, 3vw, 40px)',
        paddingBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 40,
      }}
    >
      <AnimatePresence mode="wait">
        {phase === 'question' ? (
          <motion.div
            key="clean-birth-question"
            className="zone-loop-question profile-step-slam w-full flex flex-col items-center"
            style={{ maxWidth: 520, gap: 40 }}
            initial={stepMotion.initial}
            animate={stepMotion.animate}
            exit={stepMotion.exit}
            transition={FAMILY_TRANSITION_ATOMIC}
          >
            <span
              className="card-top-label solo-focus-zone-category m-0 text-center w-full block"
              style={{ color: 'var(--color-yellow)' }}
            >
              {zoneCategoryLabel}
            </span>
            <div
              id="discovery-takeover-question"
              className="text-marvin profile-question-headline"
              style={{
                marginBottom: 0,
                marginLeft: 'auto',
                marginRight: 'auto',
                maxWidth: 'min(92vw, 28rem)',
                textAlign: 'center',
                whiteSpace: 'pre-line',
              }}
            >
              {loopQuestionDisplayText(beat)}
            </div>
            <div className="profile-step-controls profile-step-controls--options w-full">
              {beat.options.map((opt, optionIndex) => (
                <ProfileAnswerBtn
                  key={opt.value}
                  reduceMotion={reduceMotion}
                  optionIndex={optionIndex}
                  delaySeconds={familyControlDelaySec(optionIndex, controlsAfterQuestionSec)}
                  className=""
                  disabled={answerLocked}
                  onClick={() => handleAnswer(opt.value)}
                  aria-label={
                    opt.ariaLabel ??
                    String(opt.label).replace(/_/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
                  }
                >
                  <span className="profile-answer-btn__text zz-h4">
                    {opt.label.replace(/_/g, '\n')}
                  </span>
                </ProfileAnswerBtn>
              ))}
            </div>
          </motion.div>
        ) : phase === 'pulse' ? (
          <motion.div
            key="clean-birth-pulse"
            className="w-full flex items-center justify-center"
            style={{ minHeight: 'min(72vh, 520px)' }}
            initial={stepMotion.initial}
            animate={stepMotion.animate}
            exit={stepMotion.exit}
            transition={FAMILY_TRANSITION_ATOMIC}
          >
            <ArchitecturalPulse
              words={CLEAN_BIRTH_PULSE_WORDS}
              inline
              onComplete={() => setPulseWordsComplete(true)}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.main>,
    document.body
  )
}
