'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AgentShell } from '@/app/components/agents/AgentShell'
import { cardOptionAnswer, type CardQuestion, type CardQuestionOption } from '@/lib/zone/cardQuestions'
import { clientHousehold, isQuestionResting, persistCardAnswer, restQuestion } from '@/lib/zone/soloFocusInsight'
import { nextKnowledgeQuestions, overallKnowledge, type KnowledgeSummary } from '@/lib/zoneAgents/knowledge/logic'
import { onKnowledgeSynced } from '@/lib/knowledge/client'
import { JOURNEY_LABELS } from '@/lib/journeys'
import { ROUTES } from '@/lib/routes'

const EASE = [0.22, 1, 0.36, 1] as const

/** Know your home: the most useful missing questions across every category, one tap each. */
export function KnowledgeAgentClient() {
  const reduceMotion = useReducedMotion()
  const [questions, setQuestions] = useState<CardQuestion[] | null>(null)
  const [summary, setSummary] = useState<KnowledgeSummary | null>(null)
  const [answeredCount, setAnsweredCount] = useState(0)

  const load = useCallback(() => {
    const h = clientHousehold()
    if (!h) return
    setSummary(overallKnowledge(h))
    setQuestions(nextKnowledgeQuestions(h, (q) => isQuestionResting(q)))
  }, [])

  useEffect(() => {
    load()
    return onKnowledgeSynced(load)
  }, [load])

  const answer = (q: CardQuestion, option: CardQuestionOption) => {
    const value = cardOptionAnswer(option)
    if (value) persistCardAnswer(q.journeyId, q.questionId, value, 'agent')
    else restQuestion(q.questionId, undefined, q.journeyId, 'agent')
    setAnsweredCount((n) => n + 1)
    load()
  }

  const skip = (q: CardQuestion) => {
    restQuestion(q.questionId, undefined, q.journeyId, 'agent')
    load()
  }

  const pct = summary ? Math.round(summary.score * 100) : 0

  return (
    <AgentShell
      eyebrow="Know your home"
      title="A few quick answers"
      intro="Each answer sharpens the savings on your Zone. Skip anything you are not sure of; we will not ask again for 30 days."
      testId="agent-knowledge"
    >
      {summary ? (
        <div className="sf-deep__progress agent-brand__progress">
          <div className="sf-deep__bar" role="progressbar" aria-label="What we know" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <motion.span
              className="sf-deep__bar-fill"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.6, ease: EASE }}
            />
          </div>
          <p className="zzb-meta">
            We know {summary.known} of {summary.total} things about your home
            {answeredCount > 0 ? ` · ${answeredCount} answered just now` : ''}
          </p>
        </div>
      ) : null}

      {questions === null ? null : questions.length === 0 ? (
        <p className="zzb-body zzb-muted">
          That is everything we can ask for now. Your{' '}
          <Link href={ROUTES.ZONE} className="zzb-link">
            Zone
          </Link>{' '}
          is up to date.
        </p>
      ) : (
        <ol className="agent-brand__questions">
          <AnimatePresence initial={false}>
            {questions.map((q, i) => (
              <motion.li
                key={q.questionId}
                className="sf-deep__block agent-brand__question"
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <p className="zzb-eyebrow">
                  <span className="zzb-index">({String(i + 1).padStart(2, '0')})</span>
                  <span>{JOURNEY_LABELS[q.journeyId] ?? q.journeyId}</span>
                </p>
                <p className="zzb-h3 zzb-ink" role="heading" aria-level={2}>
                  {q.question}
                </p>
                <p className="zzb-meta">{q.whyWeAsk}</p>
                <div className="sf-deep__options" role="group" aria-label={q.question}>
                  {q.options.map((o) => (
                    <button key={o.label} type="button" className="zzb-choice" onClick={() => answer(q, o)}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <div className="sf-deep__row">
                  <button type="button" className="zzb-link" onClick={() => skip(q)}>
                    Skip
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </AgentShell>
  )
}
