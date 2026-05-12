import { PRICE_CAP_SOURCE_URL, REG_GB_BASE_G_PER_KWH } from '@/lib/brains/constants'
import {
  APRIL_2026_TRUTH_PENCE,
  buildAuditBaselineMotherCopy,
  deriveGridTier,
  ENGINE_PRICE_CAP_TYPICAL_GBP,
  getCarbonIntensity,
} from '@/lib/logic/engine'
import { getDbPool, type DbPool } from '@/lib/db'
import { getLocalData, type LocalIntelligence } from '@/lib/local/getLocalData'
import { runLiveGrounding } from '@/lib/sentinel/liveGrounding'
import type { SoftSaveCard } from '@/lib/sentinel/scraper'
import type {
  MotherChildMotherPayload,
  MotherChildSlide,
  SentinelMotherRecardPayload,
  SentinelViewState,
} from '@/lib/sentinel/recardTypes'
export type {
  MotherChildMotherPayload,
  MotherChildSlide,
  SentinelMotherRecardPayload,
  SentinelViewState,
} from '@/lib/sentinel/recardTypes'
import {
  getFoodWasteSoftSave,
  getFlowTempSoftSave,
  getPhantomStandbySoftSave,
  scaleSoftSaveForOccupancy,
  SENTINEL_VERIFIED_DATE,
} from '@/lib/sentinel/scraper'

export const APRIL_2026_ENERGY_CAP_GBP = ENGINE_PRICE_CAP_TYPICAL_GBP
export const HOME_CHILD_QUESTION = 'What is your primary heating source?'
const EST_AFFILIATE_LINK =
  'https://energysavingtrust.org.uk/advice/?utm_source=00-00&utm_medium=sentinel&utm_campaign=reg_gb_base'
const EST_URBAN_LEZ_LINK =
  'https://energysavingtrust.org.uk/advice/energy-efficient-home/?utm_source=00-00&utm_medium=sentinel&utm_campaign=reg_urban_lez'
const EST_HI_RURAL_LINK =
  'https://energysavingtrust.org.uk/advice/heating-and-hot-water/?utm_source=00-00&utm_medium=sentinel&utm_campaign=reg_hi_rural'
const EST_SOURCE_FOOTER = 'Source: National Grid | Verified April 2026'
const NESTA_SOURCE_FOOTER = 'Source: Nesta | Verified April 2026'
const WRAP_SOURCE_FOOTER = 'Source: WRAP | Verified April 2026'

type Genome = Record<string, unknown>
type TenureType = 'rent' | 'own'
type TransitMode = 'car' | 'ev' | 'public' | 'cycle' | 'unknown'
type HeatingType = 'gas' | 'elec' | 'heatpump' | 'off-grid' | 'unknown'

interface NormalizedGenome {
  occupancyCount: number
  tenureType: TenureType
  transitMode: TransitMode
  heatingType: HeatingType
}

export interface SyncUserZoneInput {
  userId: string
  location?: string | null
  genome?: Genome | null
  /**
   * Optional absolute app origin for API-based local intelligence, e.g. http://127.0.0.1:3000.
   * If omitted, runner falls back to direct local resolver.
   */
  appOrigin?: string
}

export interface MotherChildJourneyState {
  journeyKey: string
  /** P1–P3 home audit deck (baseline + behavioural slides); tenure steers ordering. */
  slides: MotherChildSlide[]
  context: {
    postcode: string
    locality: string | null
    region: string | null
    gridGPerKwh: number
    genome: Genome
  }
  /** Current mother-band slide index (lane-lock max 3 answers per session). */
  slideCursor: number
  sessionAnswerCount: number
  viewState: SentinelViewState
  /** Immutable Solo Focus lane for this persisted state (always `home` today). */
  laneJourneyKey: 'home'
}

export function primaryHomeSlide(state: MotherChildJourneyState): MotherChildSlide {
  const slides = state.slides
  if (!slides.length) {
    throw new Error('MotherChildJourneyState has no slides')
  }
  const raw = state.slideCursor
  const cursor =
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.max(0, Math.min(slides.length - 1, Math.floor(raw)))
      : 0
  const slide = slides[cursor]
  if (!slide) {
    throw new Error('MotherChildJourneyState has no slides')
  }
  return slide
}

function motherSlideToRecard(
  slide: MotherChildSlide,
  meta: { viewState: SentinelViewState; slideCursor: number; sessionAnswerCount: number }
): SentinelMotherRecardPayload {
  return {
    headline: slide.mother.heading,
    description: slide.mother.description,
    moneyValue: slide.mother.saveGbp,
    carbonValue: slide.mother.carbonKg,
    source_url: slide.mother.sourceUrl,
    verified_date: slide.mother.verifiedDate,
    viewState: meta.viewState,
    slideCursor: meta.slideCursor,
    sessionAnswerCount: meta.sessionAnswerCount,
    currentSlide: slide,
  }
}

function buildResultMotherRecard(slides: MotherChildSlide[]): SentinelMotherRecardPayload {
  const money = slides.reduce((sum, s) => sum + s.mother.saveGbp, 0)
  const carbon = slides.reduce((sum, s) => sum + s.mother.carbonKg, 0)
  const lastIdx = Math.max(0, slides.length - 1)
  return {
    headline: 'Audit: verified home profile',
    description: `April 2026 audit complete — combined indicative gap £${money.toLocaleString('en-GB')} and ${carbon} kg CO₂e.\n\n${EST_SOURCE_FOOTER}`,
    moneyValue: money,
    carbonValue: carbon,
    source_url: PRICE_CAP_SOURCE_URL,
    verified_date: SENTINEL_VERIFIED_DATE,
    viewState: 'RESULT',
    slideCursor: lastIdx,
    sessionAnswerCount: 3,
    currentSlide: null,
  }
}

/**
 * After each successful `POST /api/answers` for `home`, advance the Sentinel deck (max 3),
 * persist `journey_state`, and return Mother recard fields for the client.
 */
export async function advanceHomeJourneySentinelAfterAnswer(
  pool: DbPool,
  userId: string
): Promise<SentinelMotherRecardPayload | null> {
  let row: { rows: { state: unknown }[] }
  try {
    row = await pool.query<{ state: unknown }>(
      `SELECT state FROM journey_state WHERE user_id = $1 AND journey_key = 'home' LIMIT 1`,
      [userId]
    )
  } catch {
    return null
  }

  const raw = row.rows[0]?.state
  if (!raw || typeof raw !== 'object') return null

  const st = raw as Partial<MotherChildJourneyState>
  const slides = Array.isArray(st.slides) ? st.slides : []
  if (!slides.length) return null

  if (st.laneJourneyKey != null && st.laneJourneyKey !== 'home') {
    return null
  }

  let sessionAnswerCount =
    typeof st.sessionAnswerCount === 'number' && Number.isFinite(st.sessionAnswerCount)
      ? Math.max(0, Math.min(3, Math.floor(st.sessionAnswerCount)))
      : 0
  let slideCursor =
    typeof st.slideCursor === 'number' && Number.isFinite(st.slideCursor) ? Math.floor(st.slideCursor) : 0
  let viewState: SentinelViewState = st.viewState === 'RESULT' ? 'RESULT' : 'LIVE'

  if (viewState === 'RESULT') {
    return buildResultMotherRecard(slides as MotherChildSlide[])
  }

  sessionAnswerCount = Math.min(3, sessionAnswerCount + 1)
  slideCursor = Math.min(sessionAnswerCount, Math.max(0, slides.length - 1))
  if (sessionAnswerCount >= 3) {
    viewState = 'RESULT'
  }

  const nextState: MotherChildJourneyState = {
    ...(st as MotherChildJourneyState),
    slides: slides as MotherChildSlide[],
    slideCursor,
    sessionAnswerCount,
    viewState,
    laneJourneyKey: 'home',
  }

  await pool.query(
    `INSERT INTO journey_state (user_id, journey_key, state, updated_at)
     VALUES ($1, 'home', $2::jsonb, NOW())
     ON CONFLICT (user_id, journey_key)
     DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
    [userId, JSON.stringify(nextState)]
  )

  if (viewState === 'RESULT') {
    return buildResultMotherRecard(slides as MotherChildSlide[])
  }
  const current = slides[slideCursor] as MotherChildSlide | undefined
  if (!current) return null
  return motherSlideToRecard(current, { viewState: 'LIVE', slideCursor, sessionAnswerCount })
}

export interface SyncUserZoneResult {
  userId: string
  postcode: string
  localIntelligence: LocalIntelligence | null
  profileGenome: Genome
  homeState: MotherChildJourneyState
}

async function fetchLocalIntelligenceViaApi(
  appOrigin: string,
  postcode: string
): Promise<LocalIntelligence | null> {
  try {
    const res = await fetch(
      `${appOrigin.replace(/\/$/, '')}/api/local-intelligence?postcode=${encodeURIComponent(postcode)}`,
      { method: 'GET', headers: { Accept: 'application/json' } }
    )
    if (!res.ok) return null
    return (await res.json()) as LocalIntelligence
  } catch {
    return null
  }
}

function toPostcode(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\s+/g, '').toUpperCase().trim() : ''
}

function resolveAffiliateLinkForTier(tier: ReturnType<typeof deriveGridTier>): string {
  if (tier === 'REG_HI_RURAL') return EST_HI_RURAL_LINK
  if (tier === 'REG_URBAN_LEZ') return EST_URBAN_LEZ_LINK
  return EST_AFFILIATE_LINK
}

function toTransitMode(v: unknown): TransitMode {
  const raw = String(v ?? '').toLowerCase()
  if (raw.includes('ev')) return 'ev'
  if (raw.includes('public')) return 'public'
  if (raw.includes('cycle')) return 'cycle'
  if (raw.includes('car')) return 'car'
  return 'unknown'
}

function toHeatingType(v: unknown): HeatingType {
  const raw = String(v ?? '').toLowerCase()
  if (raw.includes('heatpump') || raw.includes('heat pump')) return 'heatpump'
  if (raw.includes('off-grid') || raw.includes('off grid') || raw.includes('oil')) return 'off-grid'
  if (raw.includes('elec') || raw.includes('electric')) return 'elec'
  if (raw.includes('gas')) return 'gas'
  return 'unknown'
}

function normalizeGenome(genome: Genome): NormalizedGenome {
  const household = (genome.household ?? {}) as Record<string, unknown>
  const travel = (genome.travel ?? {}) as Record<string, unknown>
  const home = (genome.home ?? {}) as Record<string, unknown>

  const occupancyRaw = household.occupancy_count ?? genome.occupancy_count
  const occupancyCount = Math.min(8, Math.max(1, Number.isFinite(Number(occupancyRaw)) ? Math.round(Number(occupancyRaw)) : 2))

  const tenureRaw = String(household.tenure_type ?? genome.tenure_type ?? '').toLowerCase()
  const tenureType: TenureType = tenureRaw.includes('rent') ? 'rent' : 'own'

  return {
    occupancyCount,
    tenureType,
    transitMode: toTransitMode(travel.transit_mode ?? genome.transit_mode),
    heatingType: toHeatingType(home.heating_type ?? genome.heating_type),
  }
}

function buildBehavioralSlide(card: SoftSaveCard, occupancy: number, gridGPerKwh: number): MotherChildSlide {
  const scaled = scaleSoftSaveForOccupancy(card, occupancy)
  const sourceFooter =
    card.sourceLabel === 'Nesta'
      ? NESTA_SOURCE_FOOTER
      : card.sourceLabel === 'WRAP'
        ? WRAP_SOURCE_FOOTER
        : EST_SOURCE_FOOTER
  return {
    mother: {
      heading: `Audit: ${card.headline}`,
      description: `${card.description}\n\nScaled for ${scaled.occupancy} occupants with behavioural-first logic.\n\n${sourceFooter}`,
      source: sourceFooter,
      sourceUrl: card.sourceUrl,
      verifiedDate: SENTINEL_VERIFIED_DATE,
      ctaUrl: card.sourceUrl,
      saveGbp: scaled.saveGbp,
      carbonKg: Math.max(
        0,
        Math.round((scaled.carbonKg * gridGPerKwh) / REG_GB_BASE_G_PER_KWH)
      ),
      category: 'behavioral',
    },
    child: {
      question: card.childQuestion,
      options: card.childOptions,
    },
  }
}

async function buildHomeMotherChildState(params: {
  postcode: string
  genome: Genome
  local: LocalIntelligence | null
}): Promise<MotherChildJourneyState> {
  const g = normalizeGenome(params.genome)
  const gridTier = deriveGridTier(params.postcode, params.local)
  const grid = getCarbonIntensity(params.postcode, params.local)
  const affiliateLink = resolveAffiliateLinkForTier(gridTier)
  const grounded = await runLiveGrounding({
    postcode: params.postcode,
    tenureType: g.tenureType,
    local: params.local,
    genome: params.genome,
  })
  const locality = grounded.real_locality || params.postcode
  const homeOffer = {
    label: grounded.offer_name,
    amountGbp: grounded.real_grant_amount,
    sourceUrl: grounded.source_url,
    sourceLabel: grounded.source,
  }
  const grantCarbonKg = Math.max(1, Math.round(grounded.carbon_kg))

  const elec = APRIL_2026_TRUTH_PENCE.ELECTRICITY_PER_KWH
  const gas = APRIL_2026_TRUTH_PENCE.GAS_PER_KWH
  const baselineCopy = buildAuditBaselineMotherCopy({
    locality,
    postcode: params.postcode,
    gridTier,
    gridGPerKwh: grid,
    elecPence: elec,
    gasPence: gas,
    capGbp: APRIL_2026_ENERGY_CAP_GBP,
    groundedNarrative: grounded.narrative,
    offerLabel: homeOffer.label,
    offerAmountGbp: homeOffer.amountGbp,
    sourceLabel: homeOffer.sourceLabel,
  })
  const baselineSlide: MotherChildSlide = {
    mother: {
      heading: baselineCopy.heading,
      description: baselineCopy.description,
      source: `Live Data: ${homeOffer.sourceLabel} | Grounded: April 27, 2026.`,
      sourceUrl: homeOffer.sourceUrl,
      verifiedDate: SENTINEL_VERIFIED_DATE,
      ctaUrl: affiliateLink,
      saveGbp: Math.max(0, Math.round(grounded.save_gbp)),
      carbonKg: grantCarbonKg,
      category: 'behavioral',
    },
    child: {
      question: HOME_CHILD_QUESTION,
      options: ['Gas', 'Electric', 'HeatPump', 'Off-Grid'],
    },
  }

  const flowSlide = buildBehavioralSlide(getFlowTempSoftSave(), g.occupancyCount, grid)
  const foodWasteSlide = buildBehavioralSlide(getFoodWasteSoftSave(), g.occupancyCount, grid)
  const standbySlide = buildBehavioralSlide(getPhantomStandbySoftSave(), g.occupancyCount, grid)

  const refinedLeakSlide: MotherChildSlide = {
    ...flowSlide,
    mother: {
      ...flowSlide.mother,
      heading: `Audit: heating flow @ £${flowSlide.mother.saveGbp} drift`,
      description: `${flowSlide.mother.description}\n\nRefined gap: heating flow temperature sits above an efficient band.\n\nVerified for ${params.postcode} as of April 27, 2026. Source: Nesta.\n\nLive Data: Nesta | Grounded: April 27, 2026.`,
      source: 'Live Data: Nesta | Grounded: April 27, 2026.',
      ctaUrl: affiliateLink,
    },
  }
  const verifiedSolutionSlide: MotherChildSlide = {
    ...foodWasteSlide,
    mother: {
      ...foodWasteSlide.mother,
      heading: 'Audit: verified 2026 stack',
      description: `${foodWasteSlide.mother.description}\n\nVerified solution stack: flow temperature tuning, food waste reduction, standby control.\n\nVerified for ${params.postcode} as of April 27, 2026. Source: WRAP.\n\nLive Data: WRAP | Grounded: April 27, 2026.`,
      source: 'Live Data: WRAP | Grounded: April 27, 2026.',
      ctaUrl: affiliateLink,
    },
  }
  const renterPrioritySlide: MotherChildSlide = {
    ...standbySlide,
    mother: {
      ...standbySlide.mother,
      heading: 'Audit: renter behavioural priority',
      description: `${standbySlide.mother.description}\n\nTenure is rent, so structural funding routes are excluded; behavioural audits are prioritised.\n\n${EST_SOURCE_FOOTER}`,
      source: EST_SOURCE_FOOTER,
      ctaUrl: affiliateLink,
    },
  }

  const slides: MotherChildSlide[] =
    g.tenureType === 'rent'
      ? [baselineSlide, renterPrioritySlide, verifiedSolutionSlide]
      : [baselineSlide, refinedLeakSlide, verifiedSolutionSlide]

  return {
    journeyKey: 'home',
    slides,
    context: {
      postcode: params.postcode,
      locality,
      region: params.local?.region ?? null,
      gridGPerKwh: grid,
      genome: {
        ...params.genome,
        occupancy_count: g.occupancyCount,
        tenure_type: g.tenureType,
        transit_mode: g.transitMode,
        heating_type: g.heatingType,
      },
    },
    slideCursor: 0,
    sessionAnswerCount: 0,
    viewState: 'LIVE',
    laneJourneyKey: 'home',
  }
}

/**
 * End-to-end zone sync:
 * 1) Pull user profile + genome
 * 2) Resolve local intelligence (API first when origin supplied)
 * 3) Build Mother/Child journey state payload
 * 4) Upsert into journey_state for zone waterfall population
 */
export async function syncUserZone(input: SyncUserZoneInput): Promise<SyncUserZoneResult> {
  const pool = getDbPool()
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS user_genome JSONB DEFAULT '{}'::jsonb`).catch(() => {})
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS postcode TEXT`).catch(() => {})
  const user = await pool.query<{ postcode: string | null; user_genome: Genome | null }>(
    'SELECT postcode, user_genome FROM users WHERE id = $1 LIMIT 1',
    [input.userId]
  )
  const row = user.rows[0]
  if (!row) {
    throw new Error(`User not found for syncUserZone: ${input.userId}`)
  }

  const postcode = toPostcode(input.location ?? row.postcode ?? '')
  if (!postcode) {
    throw new Error('syncUserZone requires a valid postcode context')
  }

  const dbGenome = row.user_genome && typeof row.user_genome === 'object' ? row.user_genome : {}
  const profileGenome: Genome = {
    ...(dbGenome as Genome),
    ...((input.genome && typeof input.genome === 'object' ? input.genome : {}) as Genome),
  }

  const localFromApi = input.appOrigin
    ? await fetchLocalIntelligenceViaApi(input.appOrigin, postcode)
    : null
  const localIntelligence = localFromApi ?? (await getLocalData(postcode))
  const homeState = await buildHomeMotherChildState({
    postcode,
    genome: profileGenome,
    local: localIntelligence,
  })

  await pool.query(`
    CREATE TABLE IF NOT EXISTS journey_state (
      user_id TEXT NOT NULL,
      journey_key TEXT NOT NULL,
      state JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, journey_key)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS journeys (
      user_id TEXT NOT NULL,
      journey_key TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'not_started',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, journey_key)
    )
  `)

  await pool.query(
    `INSERT INTO journey_state (user_id, journey_key, state, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (user_id, journey_key)
     DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
    [input.userId, 'home', JSON.stringify(homeState)]
  )

  await pool.query(
    `INSERT INTO journeys (user_id, journey_key, state, updated_at)
     VALUES ($1, 'home', 'in_progress', NOW())
     ON CONFLICT (user_id, journey_key)
     DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
    [input.userId]
  )

  return {
    userId: input.userId,
    postcode,
    localIntelligence,
    profileGenome,
    homeState,
  }
}
