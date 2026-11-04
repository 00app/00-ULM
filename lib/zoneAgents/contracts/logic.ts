/**
 * Contract watch agent — contracts the user told us about (Solo Focus / Know your home questions)
 * that have ended or end soon, each with the library action that fixes it.
 *
 * Pure: give it questionId → answer and a date. Answers to the date questions are ISO dates
 * (cardOptionAnswer turns "In the next 2 months" into today + N days). Nothing is guessed: a
 * contract we have no date for is not listed.
 */

import { ZONE_ACTIONS } from '@/lib/actions/actionLibrary'
import type { ZoneAction } from '@/lib/actions/actionTypes'
import { isIsoDateLike } from '@/lib/household/records'

/** Due within this many days (or already ended) switches the agent on. */
export const CONTRACT_SOON_DAYS = 60

export type ContractWatch = {
  questionId: string
  label: string
  endDate: string
  daysLeft: number
  state: 'ended' | 'soon' | 'later'
  action: ZoneAction | null
}

const CONTRACT_QUESTIONS: readonly { questionId: string; label: string; actionId: string }[] = [
  { questionId: 'tech_broadband_end', label: 'Broadband contract', actionId: 'out-of-contract-broadband' },
  { questionId: 'utilities_fix_end', label: 'Energy fixed tariff', actionId: 'energy-tariff-compare' },
]

const DAY_MS = 86_400_000

export function contractsFromAnswers(answers: Record<string, string>, now: Date = new Date()): ContractWatch[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const out: ContractWatch[] = []
  for (const q of CONTRACT_QUESTIONS) {
    const raw = answers[q.questionId]?.trim()
    if (!raw || !isIsoDateLike(raw)) continue
    const end = Date.parse(`${raw.slice(0, 10)}T00:00:00Z`)
    if (!Number.isFinite(end)) continue
    const daysLeft = Math.round((end - today) / DAY_MS)
    out.push({
      questionId: q.questionId,
      label: q.label,
      endDate: raw.slice(0, 10),
      daysLeft,
      state: daysLeft < 0 ? 'ended' : daysLeft <= CONTRACT_SOON_DAYS ? 'soon' : 'later',
      action: ZONE_ACTIONS.find((a) => a.id === q.actionId) ?? null,
    })
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft)
}

export function hasContractDue(answers: Record<string, string>, now: Date = new Date()): boolean {
  return contractsFromAnswers(answers, now).some((c) => c.state !== 'later')
}

/** "Ended 30 days ago" / "Ends in 25 days" / "Ends today". */
export function contractWhen(c: Pick<ContractWatch, 'daysLeft'>): string {
  if (c.daysLeft === 0) return 'Ends today'
  if (c.daysLeft < 0) return `Ended ${Math.abs(c.daysLeft)} day${Math.abs(c.daysLeft) === 1 ? '' : 's'} ago`
  return `Ends in ${c.daysLeft} day${c.daysLeft === 1 ? '' : 's'}`
}
