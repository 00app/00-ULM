import type { ResearchProfileData } from '@/lib/agents/researchAgent'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import {
  journeyResearchSettled,
  triggerOnboardingResearchBootstrap,
  triggerScrapeSyncForCategory,
  type ResearchCategoryCoverageRow,
} from '@/lib/researchSyncClient'
import { resolveOnboardingResearchJourneys } from '@/lib/zone/onboardingResearchBootstrap'
import {
  coverageNeedsMechanicalRepair,
  scrapedPayloadIsStale,
} from '@/lib/zone/researchStaleness'
import { appendResearchUserIdQuery } from '@/lib/zone/garyMode'

const PROD_REFRESH_KEY = 'zz_prod_research_refresh_v1'
const PROD_JIT_KEY = 'zz_prod_jit_refresh_v1'
const REFRESH_COOLDOWN_MS = 6 * 60 * 60 * 1000

function sessionFlag(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function markSessionFlag(key: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(key, '1')
  } catch {
    /* ignore */
  }
}

function readRefreshCooldown(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return false
    const ms = Number(raw)
    return Number.isFinite(ms) && Date.now() - ms < REFRESH_COOLDOWN_MS
  } catch {
    return false
  }
}

function markRefreshCooldown(key: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, String(Date.now()))
  } catch {
    /* ignore */
  }
}

/** Production cold-start: mechanical repair + capped goal-aligned JIT (no localhost-only gate). */
export function runProductionResearchRefresh(params: {
  postcode: string
  profileData?: ResearchProfileData | null
  coverage?: Record<string, ResearchCategoryCoverageRow> | null
  scraped?: Array<{ scraped_at?: string; journey_key?: string }> | null
}): void {
  if (typeof window === 'undefined') return
  const pc = String(params.postcode ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()
  if (pc.length < 4) return

  const cov = params.coverage
  const needsRepair = coverageNeedsMechanicalRepair(cov)
  const stale = scrapedPayloadIsStale(params.scraped)

  if ((needsRepair || stale) && !sessionFlag(PROD_REFRESH_KEY) && !readRefreshCooldown(PROD_REFRESH_KEY)) {
    markSessionFlag(PROD_REFRESH_KEY)
    markRefreshCooldown(PROD_REFRESH_KEY)
    const url = appendResearchUserIdQuery(
      `/api/scrape-sync?postcode=${encodeURIComponent(pc)}&repair=1`
    )
    void fetch(url, { credentials: 'include' }).catch(() => undefined)
  }

  const unsettled = JOURNEY_ORDER.filter(
    (jid) => !journeyResearchSettled(cov?.[jid], { journeyId: jid })
  )
  if (unsettled.length === 0) return
  if (sessionFlag(PROD_JIT_KEY) || readRefreshCooldown(PROD_JIT_KEY)) return

  markSessionFlag(PROD_JIT_KEY)
  markRefreshCooldown(PROD_JIT_KEY)
  triggerOnboardingResearchBootstrap({
    postcode: pc,
    profileData: params.profileData,
    dedupe: true,
  })
}

/** Second-pass JIT for journeys still unsettled after mechanical repair (staggered, cap 6). */
export function runProductionJitTopUp(params: {
  postcode: string
  profileData?: ResearchProfileData | null
  coverage?: Record<string, ResearchCategoryCoverageRow> | null
}): void {
  if (typeof window === 'undefined') return
  const pc = String(params.postcode ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()
  if (pc.length < 4) return

  const journeys = resolveOnboardingResearchJourneys({
    goal: params.profileData?.goal ?? params.profileData?.primary_goal,
    home_power: params.profileData?.home_power,
    employment_status: params.profileData?.employment_status,
    household_income_bracket: params.profileData?.household_income_bracket,
    postcode: pc,
  })

  const cov = params.coverage
  let delay = 3_000
  let fired = 0
  for (const jid of journeys) {
    if (journeyResearchSettled(cov?.[jid], { journeyId: jid })) continue
    if (fired >= 6) break
    const run = () => {
      triggerScrapeSyncForCategory({
        postcode: pc,
        category: jid,
        profileData: params.profileData,
      })
    }
    window.setTimeout(run, delay)
    delay += 4_000
    fired += 1
  }
}
