import {
  APRIL_2026_TRUTH_PENCE,
  MARCH_2026_ECONOMY,
  NORTH_SCOTLAND_KW_GRID_G_PER_KWH,
  PRICE_CAP_SOURCE_URL,
  UK_AVERAGE_GRID_INTENSITY_G_PER_KWH,
} from '@/lib/brains/constants'
import { getDbPool } from '@/lib/db'
import type { Pool } from 'pg'
import { getLocalData, type LocalIntelligence } from '@/lib/local/getLocalData'
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
  getDraughtProofingSoftSave,
  getFlowTempSoftSave,
  getPhantomStandbySoftSave,
  scaleSoftSaveForOccupancy,
  SENTINEL_VERIFIED_DATE,
} from '@/lib/sentinel/scraper'

export const APRIL_2026_ENERGY_CAP_GBP = 1641
export const WICK_GRANT_GBP = 9000
/** @deprecated Use {@link NORTH_SCOTLAND_KW_GRID_G_PER_KWH} from `lib/brains/constants` — kept for scripts/tests. */
export const NORTH_SCOTLAND_GRID_G_PER_KWH = NORTH_SCOTLAND_KW_GRID_G_PER_KWH
export const SCOTTISH_HES_URL = 'https://www.homeenergyscotland.org/home-energy-scotland-grant-loan'
export const GOV_UK_BUS_URL = 'https://www.gov.uk/apply-boiler-upgrade-scheme'
export const HOME_CHILD_QUESTION = 'What is your primary heating source?'

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
  /** P1–P3 deck for KW homeowners (grant + Nesta flow + EST standby); renters get three behavioral slides. */
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
    headline: 'VERIFIED HOME AUDIT',
    description: `April 2026 Sentinel lane complete — combined deck £${money.toLocaleString('en-GB')} with indicative ${carbon} kg CO₂e (structural + behavioural pathways, grid-scaled).`,
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
  pool: Pool,
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

function isWickContext(postcode: string): boolean {
  return /^KW/i.test(postcode)
}

function resolveGridGPerKwh(postcode: string, localCarbonG?: number): number {
  if (isWickContext(postcode)) return NORTH_SCOTLAND_KW_GRID_G_PER_KWH
  if (typeof localCarbonG === 'number' && Number.isFinite(localCarbonG) && localCarbonG > 0) {
    return localCarbonG
  }
  return UK_AVERAGE_GRID_INTENSITY_G_PER_KWH
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
  return {
    mother: {
      heading: card.headline,
      description: `${card.description} \n\nScaled for ${scaled.occupancy} people with zero-cost behaviour first logic.`,
      source: card.sourceLabel,
      sourceUrl: card.sourceUrl,
      verifiedDate: SENTINEL_VERIFIED_DATE,
      ctaUrl: card.sourceUrl,
      saveGbp: scaled.saveGbp,
      carbonKg: Math.max(
        0,
        Math.round((scaled.carbonKg * gridGPerKwh) / UK_AVERAGE_GRID_INTENSITY_G_PER_KWH)
      ),
      category: 'behavioral',
    },
    child: {
      question: card.childQuestion,
      options: card.childOptions,
    },
  }
}

function buildHomeMotherChildState(params: {
  postcode: string
  genome: Genome
  local: LocalIntelligence | null
}): MotherChildJourneyState {
  const wick = isWickContext(params.postcode)
  const g = normalizeGenome(params.genome)
  const allowStructural = g.tenureType === 'own'
  const grid = resolveGridGPerKwh(params.postcode, params.local?.localCarbonG)
  const locality = params.local?.locality ?? params.local?.council ?? null

  const structuralSave = wick ? Math.max(0, WICK_GRANT_GBP - APRIL_2026_ENERGY_CAP_GBP) : APRIL_2026_ENERGY_CAP_GBP
  const elec = APRIL_2026_TRUTH_PENCE.ELECTRICITY_PER_KWH
  const gas = APRIL_2026_TRUTH_PENCE.GAS_PER_KWH
  const busGrant = MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP

  const grantSlide: MotherChildSlide | null =
    allowStructural && wick
      ? {
          mother: {
            heading: '£9,000 RURAL HEAT GRANT (WICK / HES)',
            description: `Wick homeowners can access Home Energy Scotland rural uplift pathways up to £${WICK_GRANT_GBP.toLocaleString('en-GB')} versus the UK Boiler Upgrade Scheme ceiling of £${busGrant.toLocaleString('en-GB')} in 2026.\n\nApril 2026 reference rates: ${elec}p/kWh electricity and ${gas}p/kWh gas. Delta versus the £${APRIL_2026_ENERGY_CAP_GBP} typical cap headline is £${structuralSave} with North Scotland grid at ${grid}g/kWh.`,
            source: 'Home Energy Scotland / GOV.UK BUS April 2026',
            sourceUrl: SCOTTISH_HES_URL,
            verifiedDate: SENTINEL_VERIFIED_DATE,
            ctaUrl: SCOTTISH_HES_URL,
            saveGbp: structuralSave,
            carbonKg: Math.max(
              0,
              Math.round((structuralSave / 10) * (grid / UK_AVERAGE_GRID_INTENSITY_G_PER_KWH))
            ),
            category: 'structural',
          },
          child: {
            question: HOME_CHILD_QUESTION,
            options: ['Gas', 'Electric', 'HeatPump', 'Off-Grid'],
          },
        }
      : null

  const flowSlide = buildBehavioralSlide(getFlowTempSoftSave(), g.occupancyCount, grid)
  const draughtSlide = buildBehavioralSlide(getDraughtProofingSoftSave(), g.occupancyCount, grid)
  const standbySlide = buildBehavioralSlide(getPhantomStandbySoftSave(), g.occupancyCount, grid)

  const busSlideUk: MotherChildSlide = {
    mother: {
      heading: 'BOILER UPGRADE SCHEME 2026',
      description: `April 2026 Boiler Upgrade Scheme: up to £${busGrant.toLocaleString('en-GB')} toward a heat pump for eligible owner-occupied homes (England & Wales). Reference rates: ${elec}p/kWh electricity, ${gas}p/kWh gas; typical cap £${APRIL_2026_ENERGY_CAP_GBP}. Grid modelling intensity ${grid}g CO₂/kWh (UK average fallback 140g when API silent).`,
      source: 'GOV.UK',
      sourceUrl: GOV_UK_BUS_URL,
      verifiedDate: SENTINEL_VERIFIED_DATE,
      ctaUrl: GOV_UK_BUS_URL,
      saveGbp: busGrant,
      carbonKg: Math.max(0, Math.round((busGrant / 15) * (grid / UK_AVERAGE_GRID_INTENSITY_G_PER_KWH))),
      category: 'structural',
    },
    child: {
      question: HOME_CHILD_QUESTION,
      options: ['Gas', 'Electric', 'HeatPump', 'Off-Grid'],
    },
  }

  const slides: MotherChildSlide[] = (() => {
    if (wick) {
      if (grantSlide) return [grantSlide, flowSlide, standbySlide]
      return [flowSlide, draughtSlide, standbySlide]
    }
    if (allowStructural) {
      return [busSlideUk, flowSlide, standbySlide]
    }
    return [flowSlide, draughtSlide, standbySlide]
  })()

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
  const homeState = buildHomeMotherChildState({
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
