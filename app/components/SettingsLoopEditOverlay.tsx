'use client'

import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import type { JourneyId } from '@/lib/journeys'
import { getLoopBeatByQuestionId, type LoopAnswerSettingsRow } from '@/lib/zone/loopQuestions'
import { persistLoopAnswerLocal } from '@/lib/zone/loopMemory'
import { syncSessionState } from '@/lib/sessionStateSync'
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
  row: LoopAnswerSettingsRow
  onClose: () => void
  onSaved: () => void
}

function resolveJourneyId(row: LoopAnswerSettingsRow, beat: { journeyKeys: JourneyId[] }): JourneyId {
  if (row.journeyId) return row.journeyId
  if (beat.journeyKeys.length > 0) return beat.journeyKeys[0]!
  return 'home'
}

export function SettingsLoopEditOverlay({ row, onClose, onSaved }: Props) {
  const reduceMotion = useReducedMotion()
  const beat = getLoopBeatByQuestionId(row.questionId)
  const [locked, setLocked] = useState(false)

  const handleAnswer = useCallback(
    (answerValue: string) => {
      if (!beat || locked) return
      const answer = String(answerValue ?? '').trim()
      if (!answer) return
      setLocked(true)
      persistLoopAnswerLocal({
        journeyId: resolveJourneyId(row, beat),
        questionId: beat.questionId,
        answer,
      })
      void syncSessionState()
      onSaved()
      onClose()
    },
    [beat, locked, row, onClose, onSaved]
  )

  if (!beat || typeof document === 'undefined') return null

  const motionSafe = reduceMotion === true
  const stepMotion = familyProfileStepProps(motionSafe)
  const headlineMotion = familyRevealProps(motionSafe)
  const controlsAfterQuestionSec = familyControlDelaySec(0, 0.12)

  return createPortal(
    <main
      className="discovery-clean-birth zone-loop-takeover settings-loop-edit"
      role="dialog"
      aria-modal
      aria-labelledby="settings-loop-edit-question"
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
        className="zz-close-btn settings-loop-edit-close"
        aria-label="Back to settings"
        onClick={onClose}
        style={{ position: 'fixed', top: 20, right: 20, zIndex: 231 }}
      >
        <BackArrowDownLeft size={24} />
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
          loop answer
        </span>
        <motion.div
          id="settings-loop-edit-question"
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
          transition={FAMILY_TRANSITION_LONG}
        >
          <span style={{ whiteSpace: 'pre-line', display: 'block' }}>{beat.question}</span>
        </motion.div>
        <div className="profile-step-controls profile-step-controls--options w-full">
          {beat.options.map((opt, optionIndex) => (
            <ProfileAnswerBtn
              key={opt.value}
              className=""
              reduceMotion={reduceMotion}
              optionIndex={optionIndex}
              delaySeconds={familyControlDelaySec(optionIndex, controlsAfterQuestionSec)}
              disabled={locked}
              onClick={() => handleAnswer(opt.value)}
              aria-label={
                opt.ariaLabel ??
                String(opt.label).replace(/_/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
              }
            >
              <span className="profile-answer-btn__text zz-h4">{opt.label.replace(/_/g, '\n')}</span>
            </ProfileAnswerBtn>
          ))}
        </div>
      </motion.div>
    </main>,
    document.body
  )
}
