/**
 * Zone agents + knowledge gathering — pure checks. Run: npx tsx scripts/verify-zone-agents.ts
 *
 * Covers the agent registry (each agent has a route and only shows when its signal is on),
 * Contract watch (date maths, nothing guessed), Benefits check (only claims the library itself
 * allows, benefits check first, never for DOING_OK), Know your home (questions are real card
 * questions, one per category first, resting ones skipped) and the knowledge question map the
 * /api/knowledge route validates against.
 */

import { ZONE_AGENTS, eligibleAgents, type AgentContext } from '@/lib/zoneAgents/registry'
import { CONTRACT_SOON_DAYS, contractWhen, contractsFromAnswers, hasContractDue } from '@/lib/zoneAgents/contracts/logic'
import { BENEFITS_LEAD_ACTION, benefitsClaims, isBenefitsAgentEligible } from '@/lib/zoneAgents/benefits/logic'
import { KNOW_YOUR_HOME_THRESHOLD, nextKnowledgeQuestions, overallKnowledge } from '@/lib/zoneAgents/knowledge/logic'
import { factKeyForQuestion, isKnownQuestion } from '@/lib/knowledge/questions'
import { CARD_QUESTION_BANK, getCardQuestion } from '@/lib/zone/cardQuestions'
import { buildHousehold } from '@/lib/household/buildHousehold'
import { generateSyntheticHouseholds } from '@/lib/household/synthetic'
import { ZONE_ACTIONS } from '@/lib/actions/actionLibrary'
import { buildZaiGenomeContextPrompt } from '@/lib/brains/zai/genomeContext'
import { eligibleActions } from '@/lib/actions/selectActions'

type Check = { name: string; pass: boolean; detail?: string }
const checks: Check[] = []
const assert = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, detail })

const now = new Date('2026-11-04T12:00:00Z')
const iso = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10)

// --- Registry ----------------------------------------------------------------------------------
const quiet: AgentContext = { now, recentlyMoved: false, contractsDue: 0, benefitsDue: false, knowledgeScore: 1, knowledgeQuestionsLeft: false }
assert('agent ids are unique', new Set(ZONE_AGENTS.map((a) => a.id)).size === ZONE_AGENTS.length)
assert('four agents registered', ['moving', 'contracts', 'benefits', 'knowledge'].every((id) => ZONE_AGENTS.some((a) => a.id === id)))
for (const a of ZONE_AGENTS) {
  assert(`${a.id}: route under /agents`, a.href.startsWith('/agents/'), a.href)
  assert(`${a.id}: sentence-case CTA`, a.cta === a.cta.charAt(0).toUpperCase() + a.cta.slice(1).toLowerCase() || /[A-Z][a-z]/.test(a.cta), a.cta)
  assert(`${a.id}: no em dashes`, !/[–—]/.test(`${a.headline} ${a.why} ${a.cta}`))
}
assert('nothing on: no agents', eligibleAgents(quiet).length === 0)
assert('contract due: contracts agent', eligibleAgents({ ...quiet, contractsDue: 1 }).map((a) => a.id).join() === 'contracts')
assert('benefits due: benefits agent', eligibleAgents({ ...quiet, benefitsDue: true }).map((a) => a.id).join() === 'benefits')
assert('questions left: knowledge agent', eligibleAgents({ ...quiet, knowledgeQuestionsLeft: true }).map((a) => a.id).join() === 'knowledge')

// --- Contract watch ----------------------------------------------------------------------------
assert('no answers, no contracts', contractsFromAnswers({}, now).length === 0)
assert('not-a-date is ignored', contractsFromAnswers({ tech_broadband_end: 'SOON' }, now).length === 0)
const soon = contractsFromAnswers({ tech_broadband_end: iso(30) }, now)
assert('30 days out is soon', soon[0]?.state === 'soon' && soon[0]?.daysLeft === 30, JSON.stringify(soon))
assert('ended is ended', contractsFromAnswers({ tech_broadband_end: iso(-30) }, now)[0]?.state === 'ended')
assert('far off is later', contractsFromAnswers({ utilities_fix_end: iso(CONTRACT_SOON_DAYS + 30) }, now)[0]?.state === 'later')
assert('later alone does not switch the agent on', !hasContractDue({ utilities_fix_end: iso(200) }, now))
assert('soonest first', contractsFromAnswers({ tech_broadband_end: iso(40), utilities_fix_end: iso(10) }, now)[0]?.questionId === 'utilities_fix_end')
assert('every contract has its library action', contractsFromAnswers({ tech_broadband_end: iso(1), utilities_fix_end: iso(1) }, now).every((c) => c.action !== null))
assert('wording', contractWhen({ daysLeft: -1 }) === 'Ended 1 day ago' && contractWhen({ daysLeft: 0 }) === 'Ends today' && contractWhen({ daysLeft: 25 }) === 'Ends in 25 days')

// --- Benefits check ----------------------------------------------------------------------------
assert('tight, not checked: on', isBenefitsAgentEligible({ financial: 'TIGHT' }, {}, []))
assert('getting by: on', isBenefitsAgentEligible({ financial: 'GETTING_BY' }, {}, []))
assert('doing ok: off', !isBenefitsAgentEligible({ financial: 'DOING_OK' }, {}, []))
assert('unknown money: off', !isBenefitsAgentEligible({}, {}, []))
assert('checked this year: off', !isBenefitsAgentEligible({ financial: 'TIGHT' }, { money_benefits_checked: 'YES' }, []))
assert('benefits check done: off', !isBenefitsAgentEligible({ financial: 'TIGHT' }, {}, [{ actionId: BENEFITS_LEAD_ACTION, completedAt: now.toISOString() }]))
const tightRenter = { financial: 'TIGHT', tenure: 'RENTER', household: 'ALONE', age: 'MID', employment: 'EMPLOYED' }
const claims = benefitsClaims(tightRenter, [], now)
assert('benefits check leads', claims[0]?.id === BENEFITS_LEAD_ACTION, claims.map((c) => c.id).join())
assert('at most 8 claims', claims.length <= 8)
const allowed = new Set(eligibleActions(tightRenter, { now, month: now.getMonth() + 1 }).map((a) => a.id))
assert('every claim passes the library filters', claims.every((c) => allowed.has(c.id)), claims.map((c) => c.id).join())
assert('no pension credit for a working-age renter', !claims.some((c) => c.id === 'pension-credit'))
assert('done claims drop out', !benefitsClaims(tightRenter, [{ actionId: BENEFITS_LEAD_ACTION, completedAt: now.toISOString() }], now).some((c) => c.id === BENEFITS_LEAD_ACTION))
assert('claims are real library actions', claims.every((c) => ZONE_ACTIONS.some((a) => a.id === c.id)))

// --- Know your home ----------------------------------------------------------------------------
const households = generateSyntheticHouseholds({ count: 200, seed: 7, now })
let questionsSeen = 0
for (const s of households) {
  const h = buildHousehold(s.inputs, now)
  const k = overallKnowledge(h)
  assert(`${s.id}: knowledge score in 0-1`, k.score >= 0 && k.score <= 1 && k.known <= k.total)
  const qs = nextKnowledgeQuestions(h, () => false)
  questionsSeen += qs.length
  assert(`${s.id}: at most 6 questions`, qs.length <= 6)
  assert(`${s.id}: questions are unique`, new Set(qs.map((q) => q.questionId)).size === qs.length)
  assert(`${s.id}: only real card questions`, qs.every((q) => getCardQuestion(q.questionId) !== null))
  assert(`${s.id}: never asks a known fact`, qs.every((q) => !h.facts[q.fieldKey]), qs.map((q) => q.fieldKey).join())
  const firstCats = qs.slice(0, Math.min(qs.length, 3)).map((q) => q.journeyId)
  assert(`${s.id}: spreads across categories first`, new Set(firstCats).size === firstCats.length, firstCats.join())
  const resting = new Set(qs.map((q) => q.questionId))
  assert(`${s.id}: resting questions are skipped`, nextKnowledgeQuestions(h, (q) => resting.has(q)).every((q) => !resting.has(q.questionId)))
}
assert('synthetic households get questions to answer', questionsSeen > 0)
const empty = buildHousehold(
  { identity: { kind: 'guest', guestSessionId: 'x' }, postcode: null, profile: {}, profileAsOf: null, journeyAnswers: {}, journeyAnswersAsOf: null, loopAnswers: {}, loopAnswersAsOf: null, property: null, accounts: [], bank: null, storedFacts: [] },
  now
)
assert('an empty household is under the threshold', overallKnowledge(empty).score < KNOW_YOUR_HOME_THRESHOLD)
assert('an empty household gets questions', nextKnowledgeQuestions(empty, () => false).length > 0)

// --- Knowledge question map (what /api/knowledge accepts) --------------------------------------
for (const q of CARD_QUESTION_BANK) {
  assert(`${q.questionId}: known to the API`, isKnownQuestion(q.questionId))
  assert(`${q.questionId}: fills its fact`, factKeyForQuestion(q.questionId) === q.fieldKey)
}
assert('unknown question rejected', !isKnownQuestion('made_up') && !isKnownQuestion(''))

// --- Zai reads what they told us --------------------------------------------------------------
const zai = buildZaiGenomeContextPrompt({ userGenome: null, journeyAnswers: {}, toldUs: [{ label: 'Broadband provider', value: 'Bt' }] })
assert('zai context carries told-us facts', zai.includes('they told us') && zai.includes('Broadband provider: Bt'), zai)
assert('zai context unchanged with nothing told', !buildZaiGenomeContextPrompt({ userGenome: null, journeyAnswers: {} }).includes('they told us'))

const failed = checks.filter((c) => !c.pass)
for (const c of failed) console.error(`✗ ${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
if (failed.length > 0) {
  console.error(`[zone-agents] FAIL — ${failed.length} of ${checks.length} checks failed`)
  process.exit(1)
}
console.log(`[zone-agents] OK — ${checks.length} checks passed`)
