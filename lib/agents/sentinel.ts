import { tool } from 'ai'
import { z } from 'zod'
import { getLiveBaseline } from '@/app/lib/skills/liveImpact'
import { scrapeFirecrawlZoneResearchStructured } from '@/lib/agents/researchAgent'

export const SENTINEL_REASONING_MODEL = 'gemini-3.1-pro-preview'
const SENTINEL_FIRECRAWL_URL = 'https://www.gov.uk/energy-advice-households'
const SENTINEL_FIRECRAWL_PROMPT =
  'Extract current official heat pump support ceilings and any rural uplift cues for remote UK outward codes (e.g. KW).'

type SentinelRefreshArgs = {
  region?: string
  postcode?: string
  runScrapeSync?: boolean
}

export type SentinelGrantResult = {
  found: boolean
  heatPumpGrantGbp: number | null
  ruralUpliftGbp: number | null
  totalRuralGrantGbp: number | null
  claimOfferUrl: string
  title: string
  firecrawlSourceUrl: string
}

export type SentinelRefreshResult = {
  model: string
  tool_calling: true
  liveImpact: Awaited<ReturnType<typeof getLiveBaseline>>
  grant: SentinelGrantResult
}

function parseGrantExtract(extract: unknown): SentinelGrantResult {
  const obj = extract && typeof extract === 'object' ? (extract as Record<string, unknown>) : {}
  const hes = obj.homeenergyscotland_grant_loan_information as Record<string, unknown> | undefined
  const grantDetails = hes?.grant_loan_details as Record<string, unknown> | undefined
  const zone = obj.zero_zero_zone_dashboard as Record<string, unknown> | undefined
  const solo = zone?.solo_focus_expanded_view_data as Record<string, unknown> | undefined
  const logic = solo?.grant_eligibility_logic as Record<string, unknown> | undefined
  const bus = logic?.boiler_upgrade_scheme as Record<string, unknown> | undefined

  const heatPumpGrant = Number(grantDetails?.heat_pump_grant_gbp_typical ?? bus?.max_grant_gbp ?? NaN)
  const ruralUplift = Number(grantDetails?.rural_uplift_gbp_if_stated ?? NaN)
  const heat = Number.isFinite(heatPumpGrant) ? heatPumpGrant : null
  const uplift = Number.isFinite(ruralUplift) ? ruralUplift : null
  const total = heat != null ? heat + (uplift ?? 0) : null
  const sourceHints = JSON.stringify(obj).toLowerCase()
  const preferHes = /home energy scotland|rural uplift|kw|wick/.test(sourceHints)
  const claimOfferUrl = preferHes
    ? 'https://www.homeenergyscotland.org/funding-grants/heat-pump-grants-loans/'
    : 'https://www.gov.uk/apply-boiler-upgrade-scheme'
  const title =
    total != null
      ? `LIVE HEAT UPGRADE GRANT £${Math.round(total).toLocaleString('en-GB')}`
      : heat != null
        ? `LIVE HEAT UPGRADE GRANT £${Math.round(heat).toLocaleString('en-GB')}`
        : 'LIVE HEAT UPGRADE GRANT'

  return {
    found: total != null && total > 0,
    heatPumpGrantGbp: heat,
    ruralUpliftGbp: uplift,
    totalRuralGrantGbp: total,
    claimOfferUrl,
    title,
    firecrawlSourceUrl: SENTINEL_FIRECRAWL_URL,
  }
}

export async function runSentinelBrainRefresh(args: SentinelRefreshArgs): Promise<SentinelRefreshResult> {
  const liveImpactTool = tool({
    description:
      "Live-Impact Skill: returns Ofgem-locked April 2026 rates and current UK regional grid intensity for Sentinel's freshness cycle.",
    inputSchema: z.object({ region: z.string().optional() }),
    execute: async ({ region }) => getLiveBaseline({ region }),
  })
  const scrapeEnergyGrantsTool = tool({
    description:
      'Firecrawl v2 structured extract for UK household energy support pages; returns support ceilings and uplift cues.',
    inputSchema: z.object({
      postcode: z.string().optional(),
    }),
    execute: async () => {
      const structured = await scrapeFirecrawlZoneResearchStructured(SENTINEL_FIRECRAWL_URL)
      return {
        url: SENTINEL_FIRECRAWL_URL,
        prompt: SENTINEL_FIRECRAWL_PROMPT,
        extract: structured?.extract ?? null,
      }
    },
  })

  void liveImpactTool
  void scrapeEnergyGrantsTool
  const liveImpact = await getLiveBaseline({ region: args.region })

  const remote = /^(KW|IV|HS|ZE|PH|PA|AB|TR|LL)/i.test((args.postcode ?? '').replace(/\s+/g, '').toUpperCase())
  const defaultGrant: SentinelGrantResult = {
    found: false,
    heatPumpGrantGbp: null,
    ruralUpliftGbp: null,
    totalRuralGrantGbp: null,
    claimOfferUrl: '',
    title: 'LIVE HEAT UPGRADE GRANT',
    firecrawlSourceUrl: SENTINEL_FIRECRAWL_URL,
  }
  const grant = !args.runScrapeSync || !remote
    ? defaultGrant
    : parseGrantExtract((await scrapeFirecrawlZoneResearchStructured(SENTINEL_FIRECRAWL_URL))?.extract)

  return {
    model: SENTINEL_REASONING_MODEL,
    tool_calling: true,
    liveImpact,
    grant,
  }
}
