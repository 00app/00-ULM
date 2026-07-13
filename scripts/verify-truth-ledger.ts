/**
 * Offline audit — intelligence ledger mapping (no DB).
 */
import { auditJourneyResearchGate } from '@/lib/zone/researchGateAudit'
import { resolveZoneAuditState } from '@/lib/zone/zoneAuditUi'
import type { ResearchCategoryCoverageRow } from '@/lib/researchSyncClient'

let failed = 0

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`✗ ${msg}`)
    failed++
  } else {
    console.log(`✓ ${msg}`)
  }
}

const settledRow: ResearchCategoryCoverageRow = {
  insightReady: true,
  hasOffer: true,
  verified: true,
  latestSavingGbp: 420,
  latestVerifiedGbp: 400,
  latestOfferUrl: 'https://www.gov.uk/apply-boiler-upgrade-scheme',
  latestSourceUrl: 'https://www.gov.uk/apply-boiler-upgrade-scheme',
  architectProse: 'Paragraph one.\n\nParagraph two.\n\nParagraph three.',
  agentHeadline: 'boiler upgrade grant',
}

const gate = auditJourneyResearchGate('home', settledRow)
assert(gate.status === 'settled', 'settled coverage passes home gate')

const missing = auditJourneyResearchGate('solar', undefined)
assert(missing.status === 'missing' && missing.issues.includes('no_neon_row'), 'missing row flagged')

assert(
  resolveZoneAuditState({
    hasVerifiedNeonMoney: true,
    genomeIncomplete: false,
    propertyIntelligenceConfidence: 'ADDRESS_MATCHED',
  }) === 'LIVE_AUDIT',
  'neon + complete genome → LIVE_AUDIT'
)

assert(
  resolveZoneAuditState({
    hasVerifiedNeonMoney: false,
    genomeIncomplete: true,
    propertyIntelligenceConfidence: 'ADDRESS_MATCHED',
  }) === 'PROPERTY_VERIFIED',
  'ADDRESS_MATCHED without neon → PROPERTY_VERIFIED'
)

if (failed > 0) {
  console.error(`\n[truth-ledger-audit] FAILED — ${failed} checks`)
  process.exit(1)
}
console.log('\n[truth-ledger-audit] OK')
