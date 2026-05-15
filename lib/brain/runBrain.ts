/**
 * ZERO ZERO — Brain controller
 * Async orchestration: Local + Global (and Personal inputs) in one flow.
 * Returns both raw layers and the "data poster" shape (grid + theme) for zero-scroll Summary.
 */

import { getLocalData, type LocalIntelligence } from '@/lib/local/getLocalData'

/** Design system — Summary theme */
export const COLOR_PURPLE = '#7800ce'
export const COLOR_YELLOW = '#FDFD00'
export const COLOR_PINK = '#FF00FF'

/** UK national averages (ONS-style; replace with Nomis/ONS when integrated) */
export const UK_AVG_MONEY_GBP = 2500
export const UK_AVG_CARBON_KG = 4000

/** ~20 kg CO₂e sequestered per tree per year; for "equivalent to X trees" */
const KG_CO2_PER_TREE_EQUIVALENT = 20

export interface GlobalLayer {
  ukAvgMoney: number
  ukAvgCarbon: number
  equivalentTrees?: number
}

/** One tile in the Summary grid (label above, value in .text-data, unit) */
export interface SummaryGridItem {
  label: string
  value: string
  unit: string
}

/** Theme for Summary: bg, text, accent; Enter + SAVING GAP pink when over regional spend */
export interface SummaryTheme {
  bg: string
  text: string
  accent: string
  enterButtonColor: 'yellow' | 'pink'
  /** When true, render grid[3] (SAVING GAP) value in Pink for visual hierarchy */
  savingGapPink?: boolean
}

export interface BrainPayload {
  local: LocalIntelligence | null
  global: GlobalLayer
  ready: boolean
  /** Data poster: location string + 4 tiles + theme for Purple/Yellow CSS */
  location_label: string
  grid: [SummaryGridItem, SummaryGridItem, SummaryGridItem, SummaryGridItem]
  theme: SummaryTheme
}

export interface RunBrainOptions {
  postcode: string
  /** If provided, used to compute equivalentTrees from carbon savings vs UK avg */
  personalCarbonKg?: number
  personalMoneyGbp?: number
}

function buildSummaryGrid(
  local: LocalIntelligence | null,
  global: GlobalLayer,
  personalMoneyGbp: number | undefined,
  _personalCarbonKg: number | undefined
): BrainPayload['grid'] {
  const carbonVal = local?.localCarbonG != null ? `${local.localCarbonG}` : '—'
  const personalSpend = typeof personalMoneyGbp === 'number' ? personalMoneyGbp.toLocaleString() : '—'
  const regionalAvg = global.ukAvgMoney.toLocaleString()
  const overSpend =
    typeof personalMoneyGbp === 'number' && global.ukAvgMoney > 0 && personalMoneyGbp > global.ukAvgMoney
  const savingGapPct =
    typeof personalMoneyGbp === 'number' && global.ukAvgMoney > 0
      ? overSpend
        ? (((personalMoneyGbp - global.ukAvgMoney) / global.ukAvgMoney) * 100).toFixed(1)
        : ((1 - personalMoneyGbp / global.ukAvgMoney) * 100).toFixed(1)
      : '0'
  const savingGapValue = overSpend ? `+${savingGapPct}` : `${savingGapPct}`
  return [
    { label: 'GRID INTENSITY', value: carbonVal, unit: 'gCO2/kWh' },
    { label: 'PERSONAL SPEND', value: personalSpend.startsWith('—') ? '—' : `£${personalSpend}`, unit: '/yr' },
    { label: 'REGIONAL AVG', value: `£${regionalAvg}`, unit: '/yr' },
    { label: 'SAVING GAP', value: `${savingGapValue}%`, unit: '' },
  ]
}

/**
 * Run the Brain: Local + Global in one async flow; returns raw layers + data poster (grid + theme).
 * Enter button flips to Pink when personal spend > regional avg (urgency).
 */
export async function runBrain(options: RunBrainOptions): Promise<BrainPayload> {
  const { postcode, personalCarbonKg, personalMoneyGbp } = options
  const clean = postcode?.replace(/\s+/g, '').trim()

  const defaultGlobal: GlobalLayer = {
    ukAvgMoney: UK_AVG_MONEY_GBP,
    ukAvgCarbon: UK_AVG_CARBON_KG,
  }

  const overSpend = typeof personalMoneyGbp === 'number' && personalMoneyGbp > defaultGlobal.ukAvgMoney
  const baseTheme: SummaryTheme = {
    bg: COLOR_PURPLE,
    text: COLOR_YELLOW,
    accent: COLOR_PINK,
    enterButtonColor: overSpend ? 'pink' : 'yellow',
    savingGapPink: overSpend,
  }

  if (!clean || clean.length < 4) {
    const grid = buildSummaryGrid(null, defaultGlobal, personalMoneyGbp, personalCarbonKg)
    return {
      local: null,
      global: defaultGlobal,
      ready: true,
      location_label: `LOCALIZED TO: ${(postcode || '').toUpperCase() || '—'}`,
      grid,
      theme: baseTheme,
    }
  }

  const [local] = await Promise.all([
    getLocalData(clean),
    // Future: ONS/Nomis regional spend; council scrapers; OSM nodes.
  ])

  const global: GlobalLayer = {
    ukAvgMoney: UK_AVG_MONEY_GBP,
    ukAvgCarbon: UK_AVG_CARBON_KG,
  }

  if (typeof personalCarbonKg === 'number' && personalCarbonKg < UK_AVG_CARBON_KG) {
    const savedKg = UK_AVG_CARBON_KG - personalCarbonKg
    global.equivalentTrees = Math.max(0, Math.round(savedKg / KG_CO2_PER_TREE_EQUIVALENT))
  }

  const location_label = local
    ? `LOCALIZED TO: ${local.council.toUpperCase()}, ${local.region.toUpperCase()}`
    : (() => {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[Brain] location API failed for postcode:', clean)
        }
        return 'LOCALIZED TO: UNITED KINGDOM'
      })()

  const grid = buildSummaryGrid(local, global, personalMoneyGbp, personalCarbonKg)

  const overSpendFinal = typeof personalMoneyGbp === 'number' && personalMoneyGbp > global.ukAvgMoney
  const theme: SummaryTheme = {
    bg: COLOR_PURPLE,
    text: COLOR_YELLOW,
    accent: COLOR_PINK,
    enterButtonColor: overSpendFinal ? 'pink' : 'yellow',
    savingGapPink: overSpendFinal,
  }

  return {
    local,
    global,
    ready: true,
    location_label,
    grid,
    theme,
  }
}
