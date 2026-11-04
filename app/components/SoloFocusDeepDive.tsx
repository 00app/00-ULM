'use client'

/**
 * Solo Focus deep view (PRD v4 Z9): build the profile, then show the best move.
 *
 * Knowledge line → one question at a time (up to 3 per visit, Skip rests it 30 days) → best
 * result for this household: why (drivers with sources), impact (sourced or said to be missing),
 * how to do it (from the library action), link to the offer, Ask Zai along the way.
 * Rules decide everything shown (lib/intelligence/categories); answers re-score in place.
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getOptionFullLabel, type JourneyId } from '@/lib/journeys'
import { BrandArrow } from '@/app/components/brand/BrandArrow'
import { markGuestCompleted, postActionedCard } from '@/lib/actions/actionCompletion'
import { cardOptionAnswer, resolveGapQuestion, type CardQuestionOption } from '@/lib/zone/cardQuestions'
import { onKnowledgeSynced } from '@/lib/knowledge/client'
import type { CategoryEvaluation } from '@/lib/intelligence/categories/evaluate'
import type { InsightCard } from '@/lib/zone/insightCard'
import {
  categoryForJourney,
  evaluateClientCategory,
  howToLine,
  isQuestionResting,
  libraryAction,
  persistCardAnswer,
  pickBestCard,
  restQuestion,
} from '@/lib/zone/soloFocusInsight'

const MAX_QUESTIONS_PER_VISIT = 3
const EASE = [0.22, 1, 0.36, 1] as const

export type SoloFocusDeepDiveProps = {
  journeyId: string
  /** Library action behind this card (rock-/journey- ids), so its finding leads. */
  cardActionId?: string | null
  /** Open the Ask Zai sheet with these suggested questions. */
  onAskZai?: (questions: string[]) => void
}

function formatGbpRange(r: { low: number; high: number }): string {
  const f = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`
  return r.low === r.high ? f(r.high) : `${f(r.low)} to ${f(r.high)}`
}

/** Stored answers are tokens (TIGHT, GETTING_BY); show them as words. */
function readableValue(v: string): string {
  if (!/^[A-Z0-9_ ]+$/.test(v)) return v
  const label = getOptionFullLabel(v.trim().replace(/ /g, '_'))
  // Unmapped tokens come back as-is in capitals; sentence-case them.
  return label === label.toUpperCase() ? label.charAt(0) + label.slice(1).toLowerCase() : label
}

export function SoloFocusDeepDive({ journeyId, cardActionId = null, onAskZai }: SoloFocusDeepDiveProps) {
  const reduceMotion = useReducedMotion()
  const category = categoryForJourney(journeyId)
  const [version, setVersion] = useState(0)
  const [evaluation, setEvaluation] = useState<CategoryEvaluation | null>(null)
  const [askedThisVisit, setAskedThisVisit] = useState(0)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, boolean>>({})

  // Evaluate after mount (reads localStorage) and again after every answer.
  useEffect(() => {
    setEvaluation(category ? evaluateClientCategory(category) : null)
  }, [category, version])

  // Answers given on another device arrive from /api/knowledge after load; re-score when they land.
  useEffect(() => onKnowledgeSynced(() => setVersion((v) => v + 1)), [])

  useEffect(() => {
    setAskedThisVisit(0)
    setPickedId(null)
  }, [journeyId])

  const question = useMemo(() => {
    if (!evaluation || !category || askedThisVisit >= MAX_QUESTIONS_PER_VISIT) return null
    for (const gap of evaluation.gaps) {
      if (isQuestionResting(gap.questionId)) continue
      const q = resolveGapQuestion(gap.questionId, category as JourneyId)
      if (q) return { ...q, whyWeAsk: gap.whyWeAsk }
    }
    return null
  }, [evaluation, category, askedThisVisit])

  const findings = useMemo(
    () => (evaluation?.cards ?? []).filter((c) => c.statusTag !== 'coming_soon'),
    [evaluation]
  )
  const best: InsightCard | null = useMemo(() => {
    const picked = pickedId ? findings.find((c) => c.id === pickedId) : null
    return picked ?? pickBestCard(findings, cardActionId)
  }, [findings, pickedId, cardActionId])
  const others = findings.filter((c) => c.id !== best?.id)

  const answer = useCallback(
    (option: CardQuestionOption) => {
      if (!question) return
      const value = cardOptionAnswer(option)
      if (value) persistCardAnswer(question.journeyId, question.questionId, value)
      else restQuestion(question.questionId, Date.now(), question.journeyId)
      setAskedThisVisit((n) => n + 1)
      setVersion((v) => v + 1)
    },
    [question]
  )

  const skip = useCallback(() => {
    if (!question) return
    restQuestion(question.questionId, Date.now(), question.journeyId)
    setAskedThisVisit((n) => n + 1)
    setVersion((v) => v + 1)
  }, [question])

  if (!evaluation || !category) return null
  if (!question && !best) return null

  const { known, total } = evaluation.knowledge
  const pct = total > 0 ? Math.round((known / total) * 100) : 0
  const rise = reduceMotion
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.4, ease: EASE },
      }

  const recommended = best?.options.find((o) => o.key === best.nextStep?.optionKey) ?? best?.options[0] ?? null
  const action = libraryAction(recommended?.actionId)
  const how = action ? howToLine(action, recommended?.effortMinutes ?? null) : null
  const isDone = action ? Boolean(done[action.id]) : false
  const why = best?.why[0] ?? null
  const worth = recommended?.impact.gbpRange && recommended.impact.source ? recommended.impact : null

  return (
    <section className="sf-deep zz-brand w-full min-w-0" aria-label="Your best move">
      <AnimatePresence mode="wait" initial={false}>
        {question ? (
          <motion.div key={question.questionId} className="sf-deep__block" {...rise}>
            <p className="zzb-eyebrow">
              <span className="zzb-index">(01)</span>
              <span>Quick question</span>
            </p>
            <div className="sf-deep__progress">
              <div className="sf-deep__bar" role="progressbar" aria-label="What we know" aria-valuemin={0} aria-valuemax={total} aria-valuenow={known}>
                <motion.span
                  className="sf-deep__bar-fill"
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.6, ease: EASE }}
                />
              </div>
              <p className="zzb-meta">
                We know {known} of {total} things
              </p>
            </div>
            <p className="zzb-h3 zzb-ink" role="heading" aria-level={2}>
              {question.question}
            </p>
            <div className="sf-deep__options" role="group" aria-label={question.question}>
              {question.options.map((o) => (
                <button key={o.label} type="button" className="zzb-choice" onClick={() => answer(o)}>
                  {o.label}
                </button>
              ))}
            </div>
            <div className="sf-deep__row">
              <button type="button" className="zzb-link" onClick={skip}>
                Skip
              </button>
              {onAskZai ? (
                <button
                  type="button"
                  className="zzb-link"
                  onClick={() => onAskZai(['Why does this matter?', 'How do I find this out?'])}
                >
                  Not sure? Ask Zai
                </button>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        {best ? (
          <motion.div key={`${best.id}-${version}`} className="sf-deep__block" {...rise}>
            <p className="zzb-eyebrow">
              <span className="zzb-index">({question ? '02' : '01'})</span>
              <span>Your best move</span>
            </p>
            <p className="zzb-h3 zzb-ink" role="heading" aria-level={2}>
              {best.headline}
            </p>
            <dl className="sf-deep__facts">
              {why ? (
                <div>
                  <dt className="zzb-meta">Why</dt>
                  <dd className="zzb-body zzb-ink">
                    {why.label}: {readableValue(why.value)}
                  </dd>
                </div>
              ) : null}
              {worth ? (
                <div>
                  <dt className="zzb-meta">Worth</dt>
                  <dd className="zzb-body zzb-ink">
                    About {formatGbpRange(worth.gbpRange!)} a year
                    <span className="zzb-meta" style={{ display: 'block' }}>
                      {worth.source!.name}
                    </span>
                  </dd>
                </div>
              ) : null}
              {how ? (
                <div>
                  <dt className="zzb-meta">How</dt>
                  <dd className="zzb-body zzb-ink">{how}</dd>
                </div>
              ) : null}
            </dl>

            <div className="sf-deep__row sf-deep__actions">
              {action ? (
                <a className="zzb-btn zzb-btn--blue" href={action.url} target="_blank" rel="noopener noreferrer">
                  {recommended?.label ?? action.action} <BrandArrow />
                </a>
              ) : null}
              {onAskZai ? (
                <button
                  type="button"
                  className="zzb-btn zzb-btn--outline"
                  onClick={() => onAskZai(['Is this right for me?', 'What do I need first?', 'What could go wrong?'])}
                >
                  Ask Zai
                </button>
              ) : null}
              {action ? (
                <button
                  type="button"
                  className="zzb-link"
                  aria-pressed={isDone}
                  onClick={() => {
                    markGuestCompleted(action.id)
                    void postActionedCard(action.id)
                    setDone((m) => ({ ...m, [action.id]: true }))
                  }}
                  disabled={isDone}
                >
                  {isDone ? 'Done' : 'Done it'}
                </button>
              ) : null}
            </div>
            {recommended?.commission.paid && recommended.commission.note ? (
              <p className="zzb-meta">{recommended.commission.note}</p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {others.length > 0 ? (
        <div className="sf-deep__block">
          <p className="zzb-eyebrow">
            <span className="zzb-index">({question ? '03' : '02'})</span>
            <span>Also for you</span>
          </p>
          <ul className="sf-deep__list">
            {others.slice(0, 2).map((c) => (
              <li key={c.id}>
                <button type="button" className="zzb-link" onClick={() => setPickedId(c.id)}>
                  {c.headline} <BrandArrow />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
