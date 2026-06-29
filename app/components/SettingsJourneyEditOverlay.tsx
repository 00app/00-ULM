'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { getJourneyQuestions, type JourneyId } from '@/lib/journeys'
import { ROUTES } from '@/lib/routes'
import { useApp } from '@/app/context/AppContext'
import { syncSessionState } from '@/lib/sessionStateSync'
import { submitSoloFocusJourneyAnswer } from '@/lib/zone/submitSoloFocusJourneyAnswer'
import {
  answersEqual,
  dispatchAnswerCommitted,
  readJourneyAnswerRaw,
  writeSettingsEditZoneHandoff,
} from '@/lib/zone/settingsEditHandoff'
import { persistUnifiedUserProfileMemory } from '@/lib/unifiedProfileMemory'
import ProfileAnswerBtn from '@/app/components/ui/ProfileAnswerBtn'
import BackArrowDownLeft from '@/app/components/BackArrowDownLeft'
import {
  familyControlDelaySec,
  familyProfileStepProps,
  familyRevealProps,
  FAMILY_TRANSITION_ATOMIC,
  FAMILY_TRANSITION_LONG,
} from '@/lib/motion-family'

type Props = {
  journeyId: JourneyId
  title: string
  onClose: () => void
}

export function SettingsJourneyEditOverlay({ journeyId, title, onClose }: Props) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const { state } = useApp()
  const [locked, setLocked] = useState(false)
  const [step, setStep] = useState(0)
  const snapshotRef = useRef<Record<string, string>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`journey_${journeyId}_answers`)
      snapshotRef.current = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    } catch {
      snapshotRef.current = {}
    }
  }, [journeyId])

  const questions = useMemo(() => getJourneyQuestions(journeyId), [journeyId])
  const answeredQuestions = useMemo(
    () => questions.filter((q) => readJourneyAnswerRaw(journeyId, q.id).length > 0),
    [journeyId, questions]
  )
  const editQuestions = answeredQuestions.length > 0 ? answeredQuestions : questions
  const question = editQuestions[step] ?? editQuestions[0]

  const handleAnswer = useCallback(
    async (answerValue: string) => {
      if (!question || locked) return
      const answer = String(answerValue ?? '').trim()
      if (!answer) return

      const prior = String(snapshotRef.current[question.id] ?? readJourneyAnswerRaw(journeyId, question.id)).trim()
      if (answersEqual(prior, answer)) {
        onClose()
        return
      }

      setLocked(true)
      dispatchAnswerCommitted({ journeyId, questionId: question.id, answerValue: answer })
      try {
        persistUnifiedUserProfileMemory()
      } catch {
        /* ignore */
      }

      try {
        const postcode = state.profile?.postcode ?? null
        await submitSoloFocusJourneyAnswer({
          journeyId,
          questionId: question.id,
          answerValue: answer,
          postcode,
          cardId: `journey-${journeyId}`,
        })

        void syncSessionState()

        writeSettingsEditZoneHandoff({
          journeyKey: journeyId,
          cardId: `journey-${journeyId}`,
          surface: 'journey',
        })

        onClose()
        router.push(ROUTES.ZONE)
      } catch {
        setLocked(false)
      }
    },
    [question, locked, journeyId, onClose, router, state.profile?.postcode]
  )

  if (!question || typeof document === 'undefined') return null

  const motionSafe = reduceMotion === true
  const stepMotion = familyProfileStepProps(motionSafe)
  const headlineMotion = familyRevealProps(motionSafe)
  const controlsAfterQuestionSec = familyControlDelaySec(0, 0.12)

  return createPortal(
    <main
      className="discovery-clean-birth zone-loop-takeover settings-journey-edit"
      role="dialog"
      aria-modal
      aria-labelledby="settings-journey-edit-question"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 230,
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
        background: 'var(--color-purple)',
      }}
    >
      <button
        type="button"
        className="zz-close-btn settings-journey-edit-close"
        aria-label="Back to settings"
        onClick={onClose}
      >
        <BackArrowDownLeft size={18} />
      </button>
      <motion.div
        className="zone-loop-question profile-step-slam w-full flex flex-col items-center"
        style={{ gap: 40, maxWidth: 520 }}
        initial={stepMotion.initial}
        animate={stepMotion.animate}
        exit={stepMotion.exit}
        transition={FAMILY_TRANSITION_ATOMIC}
      >
        <span
          className="card-top-label solo-focus-zone-category m-0 text-center w-full block"
          style={{ color: 'var(--color-yellow)' }}
        >
          {title}
        </span>
        {editQuestions.length > 1 ? (
          <div className="flex flex-row flex-wrap gap-2 justify-center w-full">
            {editQuestions.map((q, i) => (
              <button
                key={q.id}
                type="button"
                className={`zz-h4 settings-journey-edit-step${i === step ? ' settings-journey-edit-step--active' : ''}`}
                style={{
                  color: i === step ? 'var(--color-purple)' : 'var(--color-yellow)',
                  background: i === step ? 'var(--color-yellow)' : 'transparent',
                  border: '2px solid var(--color-yellow)',
                  borderRadius: 9999,
                  padding: '6px 12px',
                  cursor: 'pointer',
                }}
                onClick={() => setStep(i)}
                disabled={locked}
              >
                {i + 1}
              </button>
            ))}
          </div>
        ) : null}
        <motion.div
          id="settings-journey-edit-question"
          className="text-marvin profile-question-headline"
          style={{
            marginBottom: 0,
            marginLeft: 'auto',
            marginRight: 'auto',
            maxWidth: 'min(92vw, 28rem)',
            textAlign: 'center',
            whiteSpace: 'pre-line',
          }}
          initial={headlineMotion.initial}
          animate={headlineMotion.animate}
          exit={headlineMotion.exit}
          transition={FAMILY_TRANSITION_LONG}
        >
          {question.label}
        </motion.div>
        <div className="profile-step-controls profile-step-controls--options w-full">
          {(question.options ?? []).map((opt, optionIndex) => (
            <ProfileAnswerBtn
              key={opt}
              className=""
              reduceMotion={reduceMotion}
              optionIndex={optionIndex}
              delaySeconds={familyControlDelaySec(optionIndex, controlsAfterQuestionSec)}
              disabled={locked}
              onClick={() => void handleAnswer(opt)}
              aria-label={opt.replace(/_/g, ' ')}
            >
              <span className="profile-answer-btn__text zz-h4">{opt.replace(/_/g, '\n')}</span>
            </ProfileAnswerBtn>
          ))}
        </div>
      </motion.div>
    </main>,
    document.body
  )
}
