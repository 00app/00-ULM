'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import type { JourneyId } from '@/lib/journeys'
import { formatZoneCategoryLabel } from '@/lib/soloFocusCopy'
import ProfileAnswerBtn from '@/app/components/ui/ProfileAnswerBtn'
import {
  offerFeedbackBeat,
  offerFeedbackQuestionText,
  persistOfferFeedbackLocal,
  persistOfferFeedbackRemote,
  type OfferFeedbackSignal,
} from '@/lib/zone/offerFeedbackLoop'
import {
  familyControlDelaySec,
  familyProfileStepProps,
  FAMILY_DUR_ATOMIC,
  FAMILY_TRANSITION_ATOMIC,
} from '@/lib/motion-family'

type Props = {
  open: boolean
  journeyId: JourneyId
  cardId: string
  cardTitle: string
  cardHeadline?: string
  signal: OfferFeedbackSignal
  onComplete: (signal: OfferFeedbackSignal) => void
}

export function OfferFeedbackTakeover({
  open,
  journeyId,
  cardId,
  cardTitle,
  cardHeadline,
  signal,
  onComplete,
}: Props) {
  const reduceMotion = useReducedMotion()
  const beat = offerFeedbackBeat(signal)
  const [answerLocked, setAnswerLocked] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [pendingSignal, setPendingSignal] = useState<OfferFeedbackSignal | null>(null)

  useEffect(() => {
    if (!open) {
      setAnswerLocked(false)
      setExiting(false)
      setPendingSignal(null)
    }
  }, [open])

  useEffect(() => {
    if (!exiting || !pendingSignal) return
    const ms = reduceMotion === true ? 150 : Math.round(FAMILY_DUR_ATOMIC * 1000)
    const t = window.setTimeout(() => onComplete(pendingSignal), ms)
    return () => window.clearTimeout(t)
  }, [exiting, pendingSignal, onComplete, reduceMotion])

  const handleAnswer = useCallback(
    (answerValue: string) => {
      if (answerLocked || exiting) return
      setAnswerLocked(true)
      persistOfferFeedbackLocal({
        cardId,
        cardTitle,
        journeyKey: journeyId,
        signal,
        questionId: beat.questionId,
        answer: answerValue,
      })
      void persistOfferFeedbackRemote({
        cardId,
        signal,
        feedbackAnswer: answerValue,
        journeyKey: journeyId,
        cardTitle,
      })
      setPendingSignal(signal)
      setExiting(true)
    },
    [answerLocked, exiting, beat.questionId, cardId, cardTitle, journeyId, signal]
  )

  if (!open || typeof document === 'undefined') return null

  const zoneCategoryLabel = formatZoneCategoryLabel(journeyId)
  const questionText = offerFeedbackQuestionText(beat, journeyId, cardTitle, cardHeadline)
  const motionSafe = reduceMotion === true
  const stepMotion = familyProfileStepProps(motionSafe)
  const controlsAfterQuestionSec = familyControlDelaySec(0, 0.12)

  return createPortal(
    <motion.main
      className="discovery-clean-birth zone-loop-takeover zone-offer-feedback-takeover"
      role="dialog"
      aria-modal
      aria-labelledby="offer-feedback-question"
      initial={stepMotion.initial}
      animate={exiting ? stepMotion.exit : stepMotion.animate}
      transition={FAMILY_TRANSITION_ATOMIC}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 221,
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
      <motion.div
        className="zone-loop-question profile-step-slam w-full flex flex-col items-center"
        style={{ maxWidth: 520, gap: 40 }}
        animate={exiting ? stepMotion.exit : stepMotion.animate}
        transition={FAMILY_TRANSITION_ATOMIC}
      >
        <span
          className="card-top-label solo-focus-zone-category m-0 text-center w-full block"
          style={{ color: 'var(--color-yellow)' }}
        >
          {zoneCategoryLabel}
        </span>
        <div
          id="offer-feedback-question"
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
          {questionText}
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
              <span className="profile-answer-btn__text zz-h4">{opt.label}</span>
            </ProfileAnswerBtn>
          ))}
        </div>
      </motion.div>
    </motion.main>,
    document.body
  )
}
