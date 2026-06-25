import type { Pool } from 'pg'
import { JOURNEY_ORDER, JOURNEYS, type JourneyId } from '@/lib/journeys'
import { readPropertyIntelligenceFromGenome } from '@/lib/intelligence/enrichProfileDataFromGenome'
import type {
  IntelligenceLedger,
  TruthLedgerDisplayStatus,
  TruthLedgerJourneyRow,
  TruthLedgerSignal,
} from '@/lib/intelligence/intelligenceLedgerTypes'
import { auditJourneyResearchGate } from '@/lib/zone/researchGateAudit'
import { resolveZoneAuditState } from '@/lib/zone/zoneAuditUi'
import type { ResearchCategoryCoverageRow } from '@/lib/researchSyncClient'
import { isUtilitiesZoneCardUnlocked } from '@/lib/zone/utilitiesZoneUnlock'
import { journeyHasProfileSeed } from '@/lib/zone/mechanicalTruth'

const LOOP_QUESTIONS_TOTAL = JOURNEY_ORDER.reduce(
  (n, jid) => n + (JOURNEYS[jid]?.questions.length ?? 0),
  0
)

const PROFILE_STEP_KEYS = [
  'name',
  'postcode',
  'household',
  'home_type',
  'home_power',
  'transport_baseline',
  'age_group',
  'employment_status',
] as const

function toNum(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function mapCoverageRows(
  rows: Array<{
    cat: string
    architect_prose: string | null
    agent_headline: string | null
    offer_url: string | null
    source_url: string | null
    saving_amount_gbp: unknown
    verified_saving: unknown
    verified: unknown
    last_visited_at: Date | string | null
  }>
): Record<string, ResearchCategoryCoverageRow> {
  const out: Record<string, ResearchCategoryCoverageRow> = {}
  for (const row of rows) {
    const k = String(row.cat || '').trim().toLowerCase()
    if (!k) continue
    const prose = typeof row.architect_prose === 'string' ? row.architect_prose.trim() : ''
    const headline = typeof row.agent_headline === 'string' ? row.agent_headline.trim() : ''
    const offer = typeof row.offer_url === 'string' ? row.offer_url.trim() : ''
    const src = typeof row.source_url === 'string' ? row.source_url.trim() : ''
    const sav = toNum(row.saving_amount_gbp)
    const ver = toNum(row.verified_saving)
    const hasOffer = offer.startsWith('http')
    const hasSrc = src.startsWith('http')
    const insightReady =
      prose.length > 0 ||
      headline.length > 0 ||
      (sav != null && sav > 0) ||
      (ver != null && ver > 0) ||
      hasOffer
    const visitedRaw = row.last_visited_at
    void visitedRaw
    out[k] = {
      insightReady,
      hasOffer,
      verified: row.verified === true,
      latestSavingGbp: sav,
      latestVerifiedGbp: ver,
      latestOfferUrl: hasOffer ? offer.slice(0, 2048) : null,
      latestSourceUrl: hasSrc ? src.slice(0, 2048) : null,
      architectProse: prose.length > 0 ? prose.slice(0, 4000) : null,
      agentHeadline: headline.length > 0 ? headline.slice(0, 320) : null,
    }
  }
  return out
}

function mapLastVisitedByJourney(
  rows: Array<{ cat: string; last_visited_at: Date | string | null }>
): Partial<Record<JourneyId, string>> {
  const out: Partial<Record<JourneyId, string>> = {}
  for (const row of rows) {
    const jid = String(row.cat || '').trim().toLowerCase() as JourneyId
    if (!(JOURNEY_ORDER as readonly string[]).includes(jid)) continue
    const visitedRaw = row.last_visited_at
    if (!visitedRaw) continue
    const iso =
      visitedRaw instanceof Date
        ? visitedRaw.toISOString()
        : new Date(String(visitedRaw)).toISOString()
    out[jid] = iso
  }
  return out
}

function displayStatusForJourney(
  journeyId: JourneyId,
  gateStatus: ReturnType<typeof auditJourneyResearchGate>['status'],
  issues: string[],
  profile?: { home_power?: string | null }
): TruthLedgerDisplayStatus {
  if (gateStatus === 'settled') return 'settled'
  if (issues.length > 0) return 'bleed'
  if (
    gateStatus === 'missing' &&
    journeyId === 'utilities' &&
    isUtilitiesZoneCardUnlocked({ home_power: profile?.home_power ?? undefined })
  ) {
    return 'estimated'
  }
  if (gateStatus === 'missing' && journeyHasProfileSeed(journeyId, {
    home_power: profile?.home_power ?? undefined,
  })) {
    return 'estimated'
  }
  return 'computing'
}

function countProfileSteps(row: Record<string, unknown>): number {
  let n = 0
  for (const key of PROFILE_STEP_KEYS) {
    const v = row[key]
    if (v != null && String(v).trim()) n++
  }
  const genome = row.user_genome
  if (genome && typeof genome === 'object' && !Array.isArray(genome)) {
    const g = genome as Record<string, unknown>
    if (g.primary_goal || g.goal || g.profile_goal) n++
  }
  return Math.min(n, 9)
}

function countPropertyPrefill(genome: Record<string, unknown> | null): number {
  const sources = genome?.property_answer_sources
  if (!sources || typeof sources !== 'object' || Array.isArray(sources)) return 0
  let n = 0
  for (const journey of Object.values(sources as Record<string, unknown>)) {
    if (journey && typeof journey === 'object' && !Array.isArray(journey)) {
      n += Object.keys(journey).length
    }
  }
  return n
}

export async function buildIntelligenceLedger(
  pool: Pool,
  userId: string
): Promise<IntelligenceLedger | null> {
  const userRes = await pool.query<{
    id: string
    name: string | null
    postcode: string | null
    household: string | null
    home_type: string | null
    transport_baseline: string | null
    employment_status: string | null
    user_genome: Record<string, unknown> | null
  }>(
    `SELECT id, name, postcode, household, home_type, transport_baseline, employment_status, user_genome
     FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  )
  const user = userRes.rows[0]
  if (!user) return null

  const genome = user.user_genome ?? {}
  const propertyIntelligence = readPropertyIntelligenceFromGenome(genome)
  const goal =
    (typeof genome.primary_goal === 'string' && genome.primary_goal) ||
    (typeof genome.goal === 'string' && genome.goal) ||
    (typeof genome.profile_goal === 'string' && genome.profile_goal) ||
    null
  const homePower =
    (typeof genome.home_power === 'string' && genome.home_power) ||
    (typeof genome.homePower === 'string' && genome.homePower) ||
    null

  const [coverageRes, countsRes, signalsRes, likesRes, actionedRes, loopRes] = await Promise.all([
    pool.query<{
      cat: string
      architect_prose: string | null
      agent_headline: string | null
      offer_url: string | null
      source_url: string | null
      saving_amount_gbp: unknown
      verified_saving: unknown
      verified: unknown
      last_visited_at: Date | string | null
    }>(
      `SELECT DISTINCT ON (lower(trim(rr.category)))
          lower(trim(rr.category)) AS cat,
          rr.architect_prose,
          rr.agent_headline,
          rr.offer_url,
          rr.source_url,
          rr.saving_amount_gbp,
          rr.verified_saving,
          rr.verified,
          rr.last_visited_at
       FROM research_results rr
       WHERE rr.user_id = $1::uuid
         AND rr.category IS NOT NULL AND btrim(rr.category) <> ''
       ORDER BY lower(trim(rr.category)), rr.created_at DESC NULLS LAST`,
      [userId]
    ),
    pool.query<{ signal: string; n: string }>(
      `SELECT signal, COUNT(*)::text AS n
       FROM offer_signals
       WHERE user_id = $1
       GROUP BY signal`,
      [userId]
    ),
    pool.query<{
      signal: string
      card_id: string
      journey_key: string | null
      card_title: string | null
      feedback_answer: string | null
      money_gbp: unknown
      created_at: Date | string
    }>(
      `SELECT signal, card_id, journey_key, card_title, feedback_answer, money_gbp, created_at
       FROM offer_signals
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 24`,
      [userId]
    ),
    pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM likes WHERE user_id = $1`, [userId]),
    pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM user_actioned_cards WHERE user_id = $1`,
      [userId]
    ),
    pool.query<{ answers: Record<string, string> | null }>(
      `SELECT answers FROM journey_answers_jsonb WHERE user_id = $1`,
      [userId]
    ),
  ])

  const coverage = mapCoverageRows(coverageRes.rows)
  const lastVisitedByJourney = mapLastVisitedByJourney(coverageRes.rows)
  let loopAnswersAnswered = 0
  for (const row of loopRes.rows) {
    const ans = row.answers
    if (!ans || typeof ans !== 'object') continue
    for (const v of Object.values(ans)) {
      if (typeof v === 'string' && v.trim()) loopAnswersAnswered++
    }
  }

  const signalCounts = new Map(countsRes.rows.map((r) => [r.signal, Number(r.n)]))
  const dislikeCount = signalCounts.get('dislike') ?? 0
  const indifferentCount = signalCounts.get('indifferent') ?? 0
  const visitedJourneys = Object.keys(lastVisitedByJourney).length

  const hasVerifiedNeonMoney = Object.values(coverage).some((row) => {
    const gbp = row.latestSavingGbp ?? row.latestVerifiedGbp ?? 0
    return gbp != null && gbp > 0
  })
  const genomeIncomplete = countProfileSteps(user as Record<string, unknown>) < 7
  const auditState = resolveZoneAuditState({
    hasVerifiedNeonMoney,
    genomeIncomplete,
    propertyIntelligenceConfidence: propertyIntelligence?.confidence ?? null,
  })

  const journeys: TruthLedgerJourneyRow[] = JOURNEY_ORDER.map((journeyId) => {
    const row = coverage[journeyId] ?? coverage[journeyId.toLowerCase()]
    const gate = auditJourneyResearchGate(journeyId, row)
    const displayStatus = displayStatusForJourney(journeyId, gate.status, gate.issues, {
      home_power: homePower,
    })
    return {
      journeyId,
      displayStatus,
      issues: gate.issues,
      savingGbp: row?.latestSavingGbp ?? gate.savingGbp,
      verifiedSavingGbp: row?.latestVerifiedGbp ?? null,
      verified: row?.verified === true,
      hasOffer: gate.hasOffer,
      offerUrl: row?.latestOfferUrl ?? null,
      sourceUrl: row?.latestSourceUrl ?? null,
      lastVisitedAt: lastVisitedByJourney[journeyId] ?? null,
      agentHeadline: row?.agentHeadline ?? null,
    }
  })

  const recentSignals: TruthLedgerSignal[] = signalsRes.rows.map((row) => ({
    signal: row.signal,
    cardId: row.card_id,
    journeyKey: row.journey_key,
    cardTitle: row.card_title,
    feedbackAnswer: row.feedback_answer,
    moneyGbp: toNum(row.money_gbp),
    at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(String(row.created_at)).toISOString(),
  }))

  const likesCount = Number(likesRes.rows[0]?.n ?? 0)
  const actionedCount = Number(actionedRes.rows[0]?.n ?? 0)

  return {
    generatedAt: new Date().toISOString(),
    userId: user.id,
    auditState,
    counts: {
      likes: likesCount,
      dislikes: dislikeCount,
      indifferent: indifferentCount,
      actioned: actionedCount,
      visitedJourneys,
      loopAnswersAnswered,
      loopQuestionsTotal: LOOP_QUESTIONS_TOTAL,
      potentialSavings: Math.max(0, likesCount - actionedCount),
      truthSavings: actionedCount,
    },
    profile: {
      name: user.name,
      postcode: user.postcode,
      goal,
      homePower,
      transport: user.transport_baseline,
      employmentStatus: user.employment_status,
      homeType: user.home_type,
      profileStepsComplete: countProfileSteps(user as Record<string, unknown>),
      profileStepsTotal: 9,
      propertyPrefillCount: countPropertyPrefill(genome),
    },
    propertyIntelligence,
    recentSignals,
    journeys,
  }
}
