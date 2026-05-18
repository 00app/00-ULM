'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { JourneyId } from '@/lib/journeys'
import { pickLoopQuestionForJourney } from '@/lib/zone/loopQuestions'
import {
  buildAchievementDiscoveryCard,
  injectNewDiscoveryCard,
  persistAchievementCardRemote,
} from '@/lib/discoveryInject'
import {
  fetchTier2ScrapeSync,
  persistTier2AnswerLocal,
  refreshZoneTotalsAfterTier2,
} from '@/lib/zone/tier2RecursiveSpawner'
import { triggerScrapeSyncForCategory } from '@/lib/researchSyncClient'
import { getDiscoveryRecommendation } from '@/lib/brains/recommendations'
import { headlineFromTitle, MAX_ZONE_CARD_HEADLINE_WORDS } from '@/lib/soloFocusCopy'
import ProfileAnswerBtn from '@/app/components/ui/ProfileAnswerBtn'
import { ArchitecturalPulse } from '@/app/components/ArchitecturalPulse'
import { CLEAN_BIRTH_PULSE_MAX_WAIT_MS } from '@/lib/architecturalPulse'
import {
  STACCATO_DURATION_SEC,
  STACCATO_DROP_PX,
  STACCATO_STAGGER_SEC,
  STACCATO_TWEEN,
  INDUSTRIAL_OPACITY_SNAP,
} from '@/lib/animations'

const TIER2_ENRICH_TIMEOUT_MS = 8000

type TakeoverPhase = 'question' | 'pulse'

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
  /** Question → pulse → pink card ready → Zone punch-through reveal. */
  onRevealComplete: () => void
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

function birthAchievementCard(params: {
  journeyId: JourneyId
  questionId: string
  answerValue: string
  title: string
  body: string
  offerUrl: string | null
}) {
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
}: Props) {
  const reduceMotion = useReducedMotion()
  const beat = pickLoopQuestionForJourney(journeyId)
  const [phase, setPhase] = useState<TakeoverPhase>('question')
  const [answerLocked, setAnswerLocked] = useState(false)
  const [pulseWordsComplete, setPulseWordsComplete] = useState(false)
  const [cardReady, setCardReady] = useState(false)
  const revealFiredRef = useRef(false)
  const controlsAfterQuestionSec = STACCATO_DURATION_SEC + STACCATO_STAGGER_SEC

  useEffect(() => {
    if (!open) {
      setPhase('question')
      setAnswerLocked(false)
      setPulseWordsComplete(false)
      setCardReady(false)
      revealFiredRef.current = false
    }
  }, [open])

  const runCleanBirthLabor = useCallback(
    async (answerValue: string) => {
      const pc = String(postcode ?? profileData?.postcode ?? '')
        .replace(/\s+/g, '')
        .trim()
        .toUpperCase()

      persistTier2AnswerLocal({
        journeyId,
        questionId: beat.questionId,
        answer: answerValue,
      })

      const rec = getDiscoveryRecommendation(journeyId, beat.questionId, answerValue)
      const fallbackTitle = headlineFromTitle(rec.headline || rec.body, MAX_ZONE_CARD_HEADLINE_WORDS)
      const fallbackUrl = rec.actionUrl ?? rec.learnUrl ?? rec.ctaUrl ?? null

      void fetch('/api/answers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journey_key: journeyId,
          question_id: beat.questionId,
          answer_value: answerValue,
          postcode: pc || undefined,
          lifestyle_mode: 'lifestyle_shift',
        }),
      }).catch(() => {})

      const optimistic = birthAchievementCard({
        journeyId,
        questionId: beat.questionId,
        answerValue,
        title: fallbackTitle,
        body: rec.body,
        offerUrl: fallbackUrl,
      })
      if (optimistic) setCardReady(true)

      if (pc.length >= 4) {
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
        try {
          const tier2 = await capTier2Fetch({
            postcode: pc,
            category: journeyId,
            answer: answerValue,
            questionId: beat.questionId,
          })
          if (tier2.ok || tier2.morphCard?.title?.trim()) {
            const enrichedTitle =
              tier2.morphCard?.title?.trim() ||
              headlineFromTitle(rec.headline || rec.body, MAX_ZONE_CARD_HEADLINE_WORDS)
            birthAchievementCard({
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
            })
          }
          void refreshZoneTotalsAfterTier2(pc)
        } catch {
          /* tier-2 optional */
        }
      }

      if (!optimistic) setCardReady(true)
    },
    [postcode, profileData, journeyId, beat.questionId]
  )

  const tryReveal = useCallback(() => {
    if (revealFiredRef.current) return
    if (!pulseWordsComplete || !cardReady) return
    revealFiredRef.current = true
    onRevealComplete()
  }, [pulseWordsComplete, cardReady, onRevealComplete])

  useEffect(() => {
    tryReveal()
  }, [tryReveal])

  useEffect(() => {
    if (phase !== 'pulse') return
    const safety = window.setTimeout(() => {
      if (!revealFiredRef.current) {
        setCardReady(true)
        setPulseWordsComplete(true)
      }
    }, CLEAN_BIRTH_PULSE_MAX_WAIT_MS)
    return () => window.clearTimeout(safety)
  }, [phase])

  const handleAnswer = useCallback(
    (answerValue: string) => {
      if (answerLocked) return
      setAnswerLocked(true)
      setPhase('pulse')
      void runCleanBirthLabor(answerValue)
    },
    [answerLocked, runCleanBirthLabor]
  )

  if (!open || typeof document === 'undefined') return null

  const stepBlockInitial = reduceMotion ? { opacity: 0 } : { opacity: 0, y: STACCATO_DROP_PX }
  const stepBlockAnimate = reduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }
  const stepBlockTransition = reduceMotion
    ? { duration: 0.12, ease: [0, 0.55, 0.45, 1] as const }
    : STACCATO_TWEEN

  return createPortal(
    <main
      className="zz-profile-page discovery-clean-birth"
      role="dialog"
      aria-modal
      aria-labelledby="discovery-takeover-question"
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
        background: 'transparent',
      }}
    >
      <AnimatePresence mode="wait">
        {phase === 'question' ? (
          <motion.div
            key="clean-birth-question"
            className="profile-step-slam w-full flex flex-col items-center"
            style={{ gap: 40, maxWidth: 520 }}
            initial={stepBlockInitial}
            animate={stepBlockAnimate}
            exit={{ opacity: 0, y: -6, transition: INDUSTRIAL_OPACITY_SNAP }}
            transition={stepBlockTransition}
          >
            <motion.div
              id="discovery-takeover-question"
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
              <span style={{ whiteSpace: 'pre-line', display: 'block' }}>{beat.question}</span>
            </motion.div>

            <motion.div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 16,
                justifyContent: 'center',
                maxWidth: 360,
              }}
            >
              {beat.options.map((opt, optionIndex) => (
                <ProfileAnswerBtn
                  key={opt.value}
                  reduceMotion={reduceMotion}
                  optionIndex={optionIndex}
                  delaySeconds={controlsAfterQuestionSec + optionIndex * STACCATO_STAGGER_SEC}
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
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="clean-birth-pulse"
            className="w-full flex items-center justify-center"
            style={{ minHeight: 'min(72vh, 520px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={INDUSTRIAL_OPACITY_SNAP}
          >
            <ArchitecturalPulse
              overlayZIndex={221}
              onComplete={() => setPulseWordsComplete(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </main>,
    document.body
  )
}
