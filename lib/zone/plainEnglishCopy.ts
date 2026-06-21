/**
 * Plain-English layer for Zone wall + Solo Focus — no scheme acronyms in user-facing copy.
 * Internal prompts may still say BUS/ECO4; always pass headlines/prose through here before display.
 */

import type { JourneyId } from '@/lib/journeys'
import { isValidJourneyId } from '@/lib/journeys'

function resolveJourneyId(id?: JourneyId | string | null): JourneyId | undefined {
  if (!id) return undefined
  const s = String(id).trim()
  return isValidJourneyId(s) ? s : undefined
}

function grantsContext(journeyId?: JourneyId | null, text?: string): boolean {
  if (journeyId === 'grants') return true
  if (journeyId === 'home' && text && /\b(?:grant|heat\s*pump|boiler\s*upgrade|insulation\s+grant)\b/i.test(text)) {
    return true
  }
  return Boolean(text && /\b(?:boiler\s*upgrade|bus\s+grant|bus\s+heat)\b/i.test(text))
}

function travelContext(journeyId?: JourneyId | null): boolean {
  return journeyId === 'travel' || journeyId === 'holidays'
}

/** Headlines / short stamps (Marvin — often uppercased upstream). */
export function humanizeZoneHeadline(text: string, journeyId?: JourneyId | string | null): string {
  let t = text.replace(/\s+/g, ' ').trim()
  if (!t) return t
  const jid = resolveJourneyId(journeyId)
  const grants = grantsContext(jid ?? null, t)
  const travel = travelContext(jid ?? null)

  if (grants) {
    t = t
      .replace(/\bBUS\s+HEAT\s+PUMP\b/gi, 'HEAT PUMP')
      .replace(/\bBUS\s+GRANT\b/gi, 'HEAT PUMP GRANT')
      .replace(/\bBUS\s+BOILER\b/gi, 'BOILER UPGRADE')
      .replace(/\bCLAIM\s+BUS\b/gi, 'CHECK HEAT PUMP GRANT')
      .replace(/\bBUS\s+AND\b/gi, 'AND')
      .replace(/\bBUS\b/gi, 'HEAT PUMP GRANT')
    t = t.replace(/\bECO4\b/gi, 'HOME INSULATION GRANT')
  }

  if (!travel) {
    t = t.replace(/\bECO4\b/gi, 'HOME INSULATION GRANT')
    t = t.replace(/\bHUG2\b/gi, 'HOME UPGRADE GRANT')
  }

  t = t
    .replace(/\bMCS\s+CERTIFIED\b/gi, 'CERTIFIED')
    .replace(/\bMCS\b/gi, 'CERTIFIED')
    .replace(/\bULEZ\b/gi, 'CLEAN-AIR CHARGE')
    .replace(/\bOFgem\b/gi, 'ENERGY REGULATOR')
    .replace(/\bOF\s*GEM\b/gi, 'ENERGY REGULATOR')

  return t.replace(/\s+/g, ' ').trim()
}

/** Body / architect prose — sentence case, full scheme names where needed. */
export function humanizeZoneProse(text: string, journeyId?: JourneyId | string | null): string {
  let t = text.replace(/\s+/g, ' ').trim()
  if (!t) return t
  const jid = resolveJourneyId(journeyId)
  const grants = grantsContext(jid ?? null, t)
  const travel = travelContext(jid ?? null)

  if (grants) {
    t = t.replace(/\bBUS\b/gi, 'boiler upgrade grant')
    t = t.replace(/\bBoiler Upgrade Scheme\b/gi, 'government heat pump grant')
  }

  t = t
    .replace(/\bECO4\b/gi, 'home insulation grant')
    .replace(/\bHUG2\b/gi, 'home upgrade grant')
    .replace(/\bMCS\b/gi, 'certified')
    .replace(/\bULEZ\b/gi, 'clean-air charge')
    .replace(/\bOfgem\b/gi, 'energy regulator')
    .replace(/\bOFgem\b/gi, 'energy regulator')
    .replace(
      /\bExecute the audited step in the CTA\b/gi,
      'Use the link below'
    )
    .replace(/\bopen the verified source\b/gi, 'use the link below')
    .replace(/\boptimization plan\b/gi, 'savings plan')
    .replace(/\bgreen funding frameworks\b/gi, 'grant programmes')

  if (travel) {
    t = t.replace(/\bBUS\b/g, 'bus')
  }

  return t.replace(/\s+/g, ' ').trim()
}

/** Stable variant index — same seed → same line; different seeds rotate lead vs closer independently. */
function detectionPhraseVariantIndex(seed: string, bucketCount: number): number {
  if (bucketCount <= 1) return 0
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h % bucketCount
}

function pickFromPhraseBank<T>(seed: string, items: readonly T[]): T {
  const idx = detectionPhraseVariantIndex(seed, items.length)
  return items[idx] ?? items[0]
}

/**
 * Rotating forensic leads — no "leaving", "you could be", or "you could miss".
 * Templates use £{money} and {topic} placeholders.
 */
const DETECTION_LEAD_BANK: Partial<Record<JourneyId, readonly string[]>> = {
  utilities: [
    'Your gas and electricity bills currently hide roughly £{money} of annual waste',
    'Roughly £{money} a year is lost to default energy tariffs',
    'You are overpaying by about £{money} annually on energy',
    '£{money} of your annual energy budget is wasted on outdated tariffs',
    'Switching supplier targets the £{money} of annual waste baked into your contract',
    'Reclaiming the £{money} a year lost to inefficient billing is a fast household win',
  ],
  home: [
    'Heating and draughts can bleed roughly £{money} a year from your home',
    'Roughly £{money} a year evaporates through poor insulation and draughts',
    'Your home heat loss currently hides about £{money} of annual waste',
    '£{money} a year drains away when draughts and insulation stay unchecked',
    'Sealing gaps targets the £{money} of warmth slipping out each winter',
  ],
  grants: [
    'Roughly £{money} a year in {topic} stays overlooked until you run the checks',
    'About £{money} in grant-backed savings can slip past if you skip eligibility checks',
    'Missed grant windows can hide roughly £{money} in annual bill relief',
    '£{money} of supported upgrades can vanish when grant rules are never checked',
  ],
  travel: [
    'Travel and fuel costs drain roughly £{money} a year on unchanged commute habits',
    'Roughly £{money} a year can slip away on {topic} without one route swap',
    'Your travel spend currently hides about £{money} of annual waste',
    'One commute change targets the £{money} lost to default fuel and mileage patterns',
  ],
  holidays: [
    'Trips and flights can bleed roughly £{money} a year when routes stay on habit',
    'Roughly £{money} a year evaporates on {topic} without a cleaner booking choice',
    'Short-haul flight spend hides about £{money} of annual waste in your trip budget',
  ],
  food: [
    'Food shopping can drain roughly £{money} a year through repeat basket waste',
    'Roughly £{money} a year slips away on {topic} without a tighter meal plan',
    'Your food spend currently hides about £{money} of avoidable annual waste',
  ],
  shopping: [
    'Everyday purchases can bleed roughly £{money} a year when buys stay on autopilot',
    'Roughly £{money} a year on {topic} is overlooked without a tighter buy list',
    'Impulse spend hides about £{money} of annual waste in things you buy',
  ],
  money: [
    'Everyday spending can drain roughly £{money} a year on fees and habits left unchecked',
    'Roughly £{money} a year slips away on {topic} without a sharper household budget',
    'Small recurring charges hide about £{money} of annual waste',
  ],
  tech: [
    'Standby power can bleed roughly £{money} a year while devices stay plugged in',
    'Roughly £{money} a year evaporates on {topic} overnight without a hard switch-off',
    'Phantom load hides about £{money} of annual waste on idle tech',
  ],
  water: [
    'Water at home can drain roughly £{money} a year through leaks and heavy use',
    'Roughly £{money} a year slips away on {topic} without usage checks',
    'Hidden water waste hides about £{money} of annual spend',
  ],
  waste: [
    'Bins and recycling habits can bleed roughly £{money} a year in hidden collection cost',
    'Roughly £{money} a year is overlooked on {topic} without a sharper sort-and-cut plan',
  ],
  solar: [
    'Solar on your roof can reclaim roughly £{money} a year when sizing matches your use',
    'Roughly £{money} a year vanishes on {topic} when export and tariff fit stay wrong',
    'Mis-sized panels hide about £{money} of annual generation value',
  ],
  carbon: [
    'Home energy use can bleed roughly £{money} a year before carbon and cost align',
    'Roughly £{money} a year of waste sits in {topic} until usage is trimmed',
  ],
}

const DEFAULT_DETECTION_LEADS: readonly string[] = [
  'Roughly £{money} a year can slip away on {topic}',
  'About £{money} of annual waste is overlooked on {topic}',
  'Your household spend currently hides roughly £{money} on {topic}',
]

/** Second beat after em dash — rotated; never "often pays you back". */
const DETECTION_CLOSER_BANK: Partial<Record<JourneyId, readonly string[]>> = {
  utilities: [
    'a tariff switch is the cleanest way to reclaim it',
    'moving off the default rate returns cash straight to your meter',
    'one supplier comparison usually surfaces the gap',
    'the waste sits in the contract — not your usage',
  ],
  home: [
    'draught tape and loft top-up are the first mechanical fixes',
    'sealing gaps stops warmth leaking before the next bill lands',
    'room-by-room draught work is cheap audit labour',
    'insulation shifts spend from loss to heat you keep',
  ],
  grants: [
    'eligibility checks belong before any install quote is signed',
    'grant rules set the ceiling — verify fit before retail price',
    'supported upgrades only count once paperwork matches your home',
    'the relief is in the rules, not the marketing page',
  ],
  travel: [
    'one day a week off the car route is enough to show in fuel',
    'rail or bus on the worst leg cuts cost without a new vehicle',
    'log mileage and mode share before you change the car',
    'the saving is in the commute pattern, not a single tank',
  ],
  holidays: [
    'train legs on short hops beat airport tax and parking',
    'booking one trip by rail instead of air shifts the whole year',
    'route choice matters more than loyalty points here',
  ],
  food: [
    'plan from what is already in the cupboard before the next shop',
    'one weekly list tied to meals cuts basket drift',
    'waste shows up in repeat buys, not portion size alone',
  ],
  shopping: [
    'a 48-hour pause on non-essentials trims impulse without a budget app',
    'buy-list discipline beats chasing discount codes',
    'the leak is repeat autopilot, not one big purchase',
  ],
  money: [
    'cancel or downgrade one recurring charge you forgot you had',
    'fees and idle subscriptions are the usual suspects',
    'a single afternoon audit on statements finds most of it',
  ],
  tech: [
    'hard-off at the wall beats smart-plug theatre overnight',
    'one power strip on entertainment kit removes phantom load',
    'standby is silent — the meter still moves',
  ],
  water: [
    'fix the slow drip and check the meter dial once a month',
    'usage spikes show in the bill before the puddle does',
    'leak detection is cheaper than assuming the tariff is wrong',
  ],
  waste: [
    'right-bin sorting cuts collection weight charges in many areas',
    'less landfill-bound weight lowers the annual line on the bill',
    'recycle stream discipline is the mechanical fix',
  ],
  solar: [
    'panel count should match roof use, not the sales brochure',
    'export tariff fit decides whether generation becomes income',
    'mis-size once and you subsidise the grid for years',
  ],
  carbon: [
    'trim usage before you buy offsets — the bill proves it',
    'kWh down is the same story as kg CO₂e down here',
    'measure the meter, then chase the supplier',
  ],
}

const DEFAULT_DETECTION_CLOSERS: readonly string[] = [
  'the fix is mechanical — small, local, and on your bill',
  'capture it with one change you can verify on the next statement',
  'audit the line item before you chase a new product',
  'the number is real once the habit or tariff moves',
]

function formatDetectionLead(template: string, moneyStr: string, topic: string): string {
  return template.replace(/\{money\}/g, moneyStr).replace(/\{topic\}/g, topic)
}

function prefixDetectionWithPlace(core: string, place: string, namePlace: boolean): string {
  if (!namePlace) return core
  const placePhrase = place === 'your area' ? 'In your area' : `In ${place}`
  return `${placePhrase}, ${core.charAt(0).toLowerCase() + core.slice(1)}`
}

/** Friendly locality lead for Solo Focus (≤30 words target; may run slightly longer with closer). */
export function buildFriendlyDetectionParagraph(params: {
  placeLabel: string
  moneyGbp: number
  journey: JourneyId
  /**
   * When true, open with "In {town}" — use sparingly (e.g. profile summary).
   * Solo Focus defaults false so the town is not repeated on every card.
   */
  namePlace?: boolean
}): string {
  const place = params.placeLabel.trim() || 'your area'
  const money = Math.max(0, Math.round(params.moneyGbp))
  const moneyStr = money.toLocaleString('en-GB')
  const namePlace = params.namePlace === true

  const topicByJourney: Partial<Record<JourneyId, string>> = {
    home: 'heating and draughts',
    utilities: 'gas and electricity',
    travel: 'travel and fuel',
    holidays: 'trips and flights',
    food: 'food shopping',
    shopping: 'things you buy',
    money: 'everyday spending',
    tech: 'standby power',
    water: 'water at home',
    waste: 'bins and recycling',
    solar: 'solar on your roof',
    carbon: 'home energy use',
    grants: 'grants and bill savings',
  }
  const topic = topicByJourney[params.journey] ?? 'home bills'

  const moneyKey = Math.max(0, money)
  const leadBank = DETECTION_LEAD_BANK[params.journey] ?? DEFAULT_DETECTION_LEADS
  const closerBank = DETECTION_CLOSER_BANK[params.journey] ?? DEFAULT_DETECTION_CLOSERS
  const leadTemplate = pickFromPhraseBank(`lead:${params.journey}:${moneyKey}`, leadBank)
  const closer = pickFromPhraseBank(`closer:${params.journey}:${moneyKey}`, closerBank)
  const core = formatDetectionLead(leadTemplate, moneyStr, topic)
  return `${prefixDetectionWithPlace(core, place, namePlace)} — ${closer}.`
}
