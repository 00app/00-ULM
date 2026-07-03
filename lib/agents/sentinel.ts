import { generateText, gateway, stepCountIs, tool } from 'ai'
import { z } from 'zod'
import { getLiveBaseline } from '@/app/lib/skills/liveImpact'
import { scrapeFirecrawlZoneResearchStructured } from '@/lib/agents/researchAgent'
import { isAiGatewayConfigured } from '@/lib/intelligence/aiGateway'
import { GEMINI_GATEWAY_ZONE, GEMINI_PRECISION_TEMPERATURE } from '@/lib/intelligence/geminiModels'

/** Matches the codebase-wide Flash standard (see geminiModels.ts) — no preview/Pro tiers. */
export const SENTINEL_REASONING_MODEL = GEMINI_GATEWAY_ZONE
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

const defaultGrant: SentinelGrantResult = {
  found: false,
  heatPumpGrantGbp: null,
  ruralUpliftGbp: null,
  totalRuralGrantGbp: null,
  claimOfferUrl: '',
  title: 'LIVE HEAT UPGRADE GRANT',
  firecrawlSourceUrl: SENTINEL_FIRECRAWL_URL,
}

/** Deterministic path — no model call. Used when the gateway isn't configured, and as the
 * safety net if the tool-calling pass throws or returns nothing usable. Sentinel must never
 * fail the request just because reasoning is unavailable. */
async function runSentinelBrainRefreshMechanical(args: SentinelRefreshArgs): Promise<SentinelRefreshResult> {
  const liveImpact = await getLiveBaseline({ region: args.region })
  const remote = /^(KW|IV|HS|ZE|PH|PA|AB|TR|LL)/i.test((args.postcode ?? '').replace(/\s+/g, '').toUpperCase())
  const grant = !args.runScrapeSync || !remote
    ? defaultGrant
    : parseGrantExtract((await scrapeFirecrawlZoneResearchStructured(SENTINEL_FIRECRAWL_URL))?.extract)

  return { model: 'mechanical', tool_calling: true, liveImpact, grant }
}

export async function runSentinelBrainRefresh(args: SentinelRefreshArgs): Promise<SentinelRefreshResult> {
  if (!isAiGatewayConfigured()) {
    return runSentinelBrainRefreshMechanical(args)
  }

  let capturedLiveImpact: Awaited<ReturnType<typeof getLiveBaseline>> | null = null
  let capturedGrantExtract: unknown = null
  let grantToolCalled = false

  const liveImpactTool = tool({
    description:
      "Live-Impact Skill: returns Ofgem-locked current UK energy rates and regional grid intensity for Sentinel's freshness cycle. Always call this first.",
    inputSchema: z.object({ region: z.string().optional() }),
    execute: async ({ region }) => {
      capturedLiveImpact = await getLiveBaseline({ region: region ?? args.region })
      return capturedLiveImpact
    },
  })

  const remote = /^(KW|IV|HS|ZE|PH|PA|AB|TR|LL)/i.test((args.postcode ?? '').replace(/\s+/g, '').toUpperCase())

  const scrapeEnergyGrantsTool = tool({
    description:
      'Firecrawl structured extract for UK household energy support pages; returns heat pump grant ceilings and rural uplift cues. Only call this when the postcode is a remote/rural UK outward code (Scottish Highlands & Islands, Cornwall — KW, IV, HS, ZE, PH, PA, AB, TR, LL) and the caller asked for a scrape sync.',
    inputSchema: z.object({ postcode: z.string().optional() }),
    execute: async () => {
      grantToolCalled = true
      const structured = await scrapeFirecrawlZoneResearchStructured(SENTINEL_FIRECRAWL_URL)
      capturedGrantExtract = structured?.extract ?? null
      return {
        url: SENTINEL_FIRECRAWL_URL,
        prompt: SENTINEL_FIRECRAWL_PROMPT,
        extract: capturedGrantExtract,
      }
    },
  })

  try {
    await generateText({
      model: gateway(SENTINEL_REASONING_MODEL),
      system:
        'You are the Sentinel freshness agent for a UK household savings app. Call get_live_impact once to refresh baseline rates and grid intensity. ' +
        (args.runScrapeSync && remote
          ? 'This postcode is remote/rural and a scrape sync was requested — also call scrape_energy_grants once to check for a live heat pump grant uplift.'
          : 'Do not call scrape_energy_grants — no scrape sync was requested, or this postcode is not remote/rural.') +
        ' Do not produce a text summary; your job is only to trigger the tool calls.',
      prompt: `region=${args.region ?? 'unknown'} postcode=${args.postcode ?? 'unknown'} runScrapeSync=${Boolean(args.runScrapeSync)}`,
      tools: { get_live_impact: liveImpactTool, scrape_energy_grants: scrapeEnergyGrantsTool },
      stopWhen: stepCountIs(3),
      temperature: GEMINI_PRECISION_TEMPERATURE,
      maxOutputTokens: 256,
    })
  } catch (err) {
    console.warn('[sentinel] tool-calling brain refresh failed, falling back to mechanical:', err instanceof Error ? err.message : err)
    return runSentinelBrainRefreshMechanical(args)
  }

  // Model chose not to call a tool, or the gateway returned no usable result — mechanical fallback
  // guarantees Sentinel still has a live baseline rather than returning stale/empty data.
  const liveImpact = capturedLiveImpact ?? (await getLiveBaseline({ region: args.region }))
  const grant =
    grantToolCalled
      ? parseGrantExtract(capturedGrantExtract)
      : !args.runScrapeSync || !remote
        ? defaultGrant
        : parseGrantExtract((await scrapeFirecrawlZoneResearchStructured(SENTINEL_FIRECRAWL_URL))?.extract)

  return {
    model: SENTINEL_REASONING_MODEL,
    tool_calling: true,
    liveImpact,
    grant,
  }
}
