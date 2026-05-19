import { isJourneyComplete, JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { buildUserImpact } from '@/lib/brains/buildUserImpact'
import type { ImpactProfile } from '@/lib/brains/types'
import { resolveLiveUnitRatesForPostcode } from '@/lib/brains/liveEconomy'

/**
 * System-prompt block: scan user_genome + journey answers before replying.
 * Completed domains → optimization tone; incomplete → discovery tone.
 */
export function buildZaiGenomeContextPrompt(args: {
  userGenome: Record<string, unknown> | null
  journeyAnswers: Record<string, Record<string, string>>
  profile?: ImpactProfile
}): string {
  const lines: string[] = []
  const genome = args.userGenome ?? {}
  const goal =
    typeof genome.profile_goal === 'string' && genome.profile_goal.trim()
      ? genome.profile_goal.trim()
      : null
  if (goal) lines.push(`profile_goal: ${goal}.`)

  const auditComplete: JourneyId[] = []
  const discoveryPending: JourneyId[] = []
  for (const jid of JOURNEY_ORDER) {
    if (isJourneyComplete(jid, args.journeyAnswers as Record<JourneyId, Record<string, string>>)) {
      auditComplete.push(jid)
    } else {
      discoveryPending.push(jid)
    }
  }
  if (auditComplete.length) {
    lines.push(`AUDIT_COMPLETE domains (optimization tone — cite their stats, do not re-ask basics): ${auditComplete.join(', ')}.`)
  }
  if (discoveryPending.length) {
    lines.push(`discovery still open: ${discoveryPending.slice(0, 6).join(', ')}${discoveryPending.length > 6 ? '…' : ''}.`)
  }

  const hermes =
    genome.hermes_memory && typeof genome.hermes_memory === 'object'
      ? (genome.hermes_memory as Record<string, unknown>)
      : null
  const last = hermes?.last_answer
  if (last && typeof last === 'object') {
    const la = last as Record<string, unknown>
    lines.push(
      `last recorded shift: ${String(la.journeyId ?? '')}.${String(la.questionId ?? '')}=${String(la.answerValue ?? '').slice(0, 80)}.`
    )
  }

  const zaiLearnings = genome.zai_chat_learnings
  if (Array.isArray(zaiLearnings) && zaiLearnings.length > 0) {
    const latest = zaiLearnings[zaiLearnings.length - 1] as Record<string, unknown>
    if (latest?.value) {
      lines.push(`latest chat learning: ${String(latest.journeyId ?? '')} — ${String(latest.value).slice(0, 120)}.`)
    }
  }

  return lines.length
    ? `\n\n--- user_genome (read before answering; never repeat postcode twice in one sentence) ---\n${lines.join('\n')}\n---`
    : ''
}

export async function summarizeImpactForUser(args: {
  profile?: ImpactProfile
  journeyAnswers: Record<JourneyId, Record<string, string>>
}): Promise<{ totalMoney: number; totalCarbon: number }> {
  const homeUnitRates = await resolveLiveUnitRatesForPostcode(args.profile?.postcode ?? null)
  const filled = Object.fromEntries(
    JOURNEY_ORDER.map((jid) => [jid, args.journeyAnswers[jid] ?? {}])
  ) as Record<JourneyId, Record<string, string>>
  const impact = buildUserImpact(
    { profile: args.profile, journeyAnswers: filled },
    homeUnitRates ? { homeUnitRates } : undefined
  )
  return {
    totalMoney: impact.totals.totalMoney,
    totalCarbon: impact.totals.totalCarbon,
  }
}
