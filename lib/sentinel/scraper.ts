/** Display lock for UI + API contract (`verified_date`). */
export const SENTINEL_VERIFIED_DATE = 'April 2026'

export type SoftSaveId =
  | 'flow-temp-55c'
  | 'phantom-load'
  | 'wash-30c'
  | 'flow-regulators'
  | 'draught-proofing'

export interface SoftSaveCard {
  id: SoftSaveId
  headline: string
  description: string
  sourceLabel: string
  sourceUrl: string
  verifiedDate: string
  annualSavingGbp: number
  annualCarbonKg: number
  childQuestion: string
  childOptions: string[]
}

export const SOFT_SAVES: SoftSaveCard[] = [
  {
    id: 'flow-temp-55c',
    headline: 'DEFEAT HIGH FLOW TEMPERATURE',
    description:
      'Lowering flow temperature to 55°C (Nesta pathway) trims wasted heat; typical households save around £70 a year.',
    sourceLabel: 'Nesta',
    sourceUrl: 'https://www.nesta.org.uk/',
    verifiedDate: SENTINEL_VERIFIED_DATE,
    annualSavingGbp: 70,
    annualCarbonKg: 78,
    childQuestion: 'What is your current boiler flow temperature?',
    childOptions: ['70C+', '60C', '55C', 'Not sure'],
  },
  {
    id: 'phantom-load',
    headline: 'DEFEAT THE PHANTOM LOAD',
    description:
      'Turning off phantom standby draw (Energy Saving Trust) can save around £45 a year across the home.',
    sourceLabel: 'Energy Saving Trust',
    sourceUrl: 'https://energysavingtrust.org.uk/',
    verifiedDate: SENTINEL_VERIFIED_DATE,
    annualSavingGbp: 45,
    annualCarbonKg: 50,
    childQuestion: 'How many devices are currently on standby?',
    childOptions: ['0-2', '3-5', '6-9', '10+'],
  },
  {
    id: 'wash-30c',
    headline: 'WASH COLD, SAVE MORE',
    description:
      'Eco-laundry at 30°C (Energy Saving Trust) cuts wash-related demand; typical saving around £27 a year.',
    sourceLabel: 'Energy Saving Trust',
    sourceUrl: 'https://energysavingtrust.org.uk/',
    verifiedDate: SENTINEL_VERIFIED_DATE,
    annualSavingGbp: 27,
    annualCarbonKg: 32,
    childQuestion: 'What wash temperature do you use most often?',
    childOptions: ['20-30C', '40C', '60C+', 'Mixed'],
  },
  {
    id: 'draught-proofing',
    headline: 'BLOCK THE DRAUGHT',
    description:
      'Draught-proofing doors, windows and letterboxes (Energy Saving Trust) stops cold air bypassing your heat; typical saving around £45 a year.',
    sourceLabel: 'Energy Saving Trust',
    sourceUrl: 'https://energysavingtrust.org.uk/',
    verifiedDate: SENTINEL_VERIFIED_DATE,
    annualSavingGbp: 45,
    annualCarbonKg: 52,
    childQuestion: 'Where do you notice cold draughts most?',
    childOptions: ['Doors', 'Windows', 'Floors / skirting', 'Several areas'],
  },
  {
    id: 'flow-regulators',
    headline: 'CUT HOT WATER WASTE',
    description:
      'Fit efficient shower flow regulators for lower hot-water use and lower gas or electric demand.',
    sourceLabel: 'Energy Saving Trust',
    sourceUrl: 'https://energysavingtrust.org.uk/',
    verifiedDate: SENTINEL_VERIFIED_DATE,
    annualSavingGbp: 40,
    annualCarbonKg: 46,
    childQuestion: 'How long is your average shower?',
    childOptions: ['<5 min', '5-8 min', '9-12 min', '12+ min'],
  },
]

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function softSaveById(id: SoftSaveId): SoftSaveCard {
  const card = SOFT_SAVES.find((s) => s.id === id)
  if (!card) throw new Error(`Unknown soft save: ${id}`)
  return card
}

/** Nesta ~£70 flow-temperature pathway (P2 deck). */
export function getFlowTempSoftSave(): SoftSaveCard {
  return softSaveById('flow-temp-55c')
}

/** EST ~£45 phantom load pathway (P3 deck). */
export function getPhantomStandbySoftSave(): SoftSaveCard {
  return softSaveById('phantom-load')
}

/** EST draught-proofing pathway — renter “soft save” lane with flow temperature. */
export function getDraughtProofingSoftSave(): SoftSaveCard {
  return softSaveById('draught-proofing')
}

export function pickBehavioralSoftSave(params: {
  occupancyCount?: unknown
  heatingType?: unknown
  transitMode?: unknown
}): SoftSaveCard {
  const heating = String(params.heatingType ?? '').toLowerCase()
  const transit = String(params.transitMode ?? '').toLowerCase()
  const occupancy = clampInt(params.occupancyCount, 1, 8, 2)

  if (heating.includes('gas') || heating.includes('boiler')) return softSaveById('flow-temp-55c')
  if (transit.includes('public') || transit.includes('cycle')) return softSaveById('wash-30c')
  if (occupancy >= 4) return softSaveById('flow-regulators')
  return softSaveById('phantom-load')
}

export function scaleSoftSaveForOccupancy(card: SoftSaveCard, occupancyCount: unknown) {
  const occupancy = clampInt(occupancyCount, 1, 8, 2)
  const multiplier = 1 + (occupancy - 1) * 0.25
  return {
    occupancy,
    saveGbp: Math.round(card.annualSavingGbp * multiplier),
    carbonKg: Math.round(card.annualCarbonKg * multiplier),
  }
}
