/**
 * Rock habit offer URLs — topic-aligned links; never blind journey fallbacks (e-bike → Eurostar).
 */

import type { RockHabit } from '@/lib/rock/types'
import { offerProviderFromHandoffUrl } from '@/lib/soloFocusSuppliedBy'
import { sanitizeZoneOfferUrl } from '@/lib/zone/offerUrlGuard'
import { trustedUrlForJourney } from '@/lib/zone/trustedJourneyUrls'

/** Slug overrides where journey_key fallback would mismatch habit topic. */
const ROCK_SLUG_OFFER_URLS: Partial<Record<string, string>> = {
  'e-bike-scheme': 'https://www.gov.uk/guidance/cycle-to-work-implementing-an-effective-scheme',
  railcard: 'https://www.railcard.co.uk/',
  'speed-cap-60': 'https://www.theaa.com/driving-advice/fuel/fuel-saving-tips',
  'cruise-control': 'https://www.iamroadsmart.com/advice/using-cruise-control',
  'combine-trips': 'https://www.rac.co.uk/drive/advice/fuel-efficiency/',
  'tyre-pressure': 'https://www.theaa.com/driving-advice/tyres/check-your-tyre-pressure',
  'ev-off-peak': 'https://octopus.energy/smart/',
  'smart-meter': 'https://octopus.energy/smart/',
  'meter-reads': 'https://www.ofgem.gov.uk/information-consumers/energy-licensing/how-read-your-gas-or-electricity-meter',
  'tariff-compare': 'https://www.moneysavingexpert.com/cheapenergyclub/',
  'green-mortgage': 'https://www.barclays.co.uk/mortgages/green-home-mortgage/',
  'microwave-small': 'https://www.which.co.uk/reviews/energy-saving-appliances/article/microwave-vs-oven-aK9pT6K8E8XH',
  'freezer-defrost': 'https://www.hotpoint.co.uk/support/home-appliances/freezers/defrosting-your-freezer',
  'slow-cooker': 'https://www.morphyrichards.co.uk/products/slow-cookers',
  'pan-lids': 'https://www.energysavingtrust.org.uk/advice/electrical-appliances/',
  'jeans-cold': 'https://www.levi.com/GB/en_GB/blog/article/sustainability/caring-for-your-denim',
  'library-ebooks': 'https://www.gov.uk/library-services',
  'print-double': 'https://support.hp.com/gb-en/help/hp-smart-app',
  'curtains-dusk': 'https://www.johnlewis.com/browse/electricals/energy-saving',
  'line-dry-week': 'https://www.whirlpool.co.uk/blog/laundry/quick-dry-fabrics',
  'pension-esg': 'https://www.which.co.uk/money/pensions',
  'air-fryer-swap': 'https://www.ninjakitchen.co.uk/',
  'tablet-over-tv': 'https://www.sony.co.uk/electronics/eco',
  'bamboo-tp': 'https://uk.whogivesacrap.org/',
  'led-everywhere': 'https://www.lighting.philips.co.uk/consumer/energy-saving-light-bulbs',
  'shower-four-min': 'https://www.waterwise.org.uk/save-water/',
  'wash-30c': 'https://www.ariel.co.uk/en-gb/washing-tips',
  'batch-cook': 'https://www.bbcgoodfood.com/howto/guide/batch-cooking-tips',
  'veg-box': 'https://www.riverford.co.uk/',
  'flex-monday': 'https://www.oxfam.org.uk/',
  'dishwasher-full': 'https://www.bosch-home.co.uk/',
  'preloved-fashion': 'https://www.vinted.co.uk/',
  'refill-stores': 'https://www.refill.org.uk/',
  'cylinder-jacket': 'https://www.britishgas.co.uk/energy/guides/insulate-your-hot-water-tank',
  'greywater-plants': 'https://www.rhs.org.uk/garden-inspiration/at-home/composting',
  'heat-pump-check': 'https://www.nesta.org.uk/project/addressing-barriers-to-heat-pump-adoption/',
  'direct-debit': 'https://www.citizensadvice.org.uk/consumer/energy/energy-supply/get-help-paying-your-bills/',
}

function normalizeProviderKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

/** Publisher home / advice pages keyed by catalog `provider_name`. */
const ROCK_PROVIDER_OFFER_URLS: Record<string, string> = {
  est: 'https://www.energysavingtrust.org.uk/advice/',
  'energy saving trust': 'https://www.energysavingtrust.org.uk/advice/',
  aa: 'https://www.theaa.com/driving-advice/',
  rac: 'https://www.rac.co.uk/drive/advice/',
  'national rail': 'https://www.railcard.co.uk/',
  'iam roadsmart': 'https://www.iamroadsmart.com/advice/',
  'gov uk': 'https://www.gov.uk/browse/environment-countryside',
  'gov.uk': 'https://www.gov.uk/browse/environment-countryside',
  ofgem: 'https://www.ofgem.gov.uk/energy-advice-households',
  octopus: 'https://octopus.energy/',
  nest: 'https://nest.com/uk/support/',
  tado: 'https://www.tado.com/gb-en/energy-saving-tips',
  philips: 'https://www.lighting.philips.co.uk/consumer/energy-saving-light-bulbs',
  waterwise: 'https://www.waterwise.org.uk/save-water/',
  'love food hate waste': 'https://www.lovefoodhatewaste.com/',
  'which?': 'https://www.which.co.uk/reviews/energy-saving-appliances',
  'bbc good food': 'https://www.bbcgoodfood.com/howto/guide/batch-cooking-tips',
  riverford: 'https://www.riverford.co.uk/',
  oxfam: 'https://www.oxfam.org.uk/',
  ninja: 'https://www.ninjakitchen.co.uk/',
  sony: 'https://www.sony.co.uk/',
  'who gives a crap': 'https://uk.whogivesacrap.org/',
  screwfix: 'https://www.screwfix.com/',
  bosch: 'https://www.bosch-home.co.uk/',
  ariel: 'https://www.ariel.co.uk/en-gb/washing-tips',
  microsoft: 'https://support.microsoft.com/en-gb/windows/battery-saving-tips-8c069865-9a58-4bd9-835a-0a0c2b0d2b6a',
  google: 'https://one.google.com/storage',
  ifixit: 'https://www.ifixit.com/',
  tesco: 'https://www.tesco.com/',
  rhs: 'https://www.rhs.org.uk/',
  'royal mail': 'https://www.royalmail.com/',
  rockwool: 'https://www.rockwool.com/gb/advice-and-inspiration/',
  'british gas': 'https://www.britishgas.co.uk/energy/guides/',
  mighton: 'https://www.mightonproducts.com/',
  tesla: 'https://www.tesla.com/en_gb/powerwall',
  nesta: 'https://www.nesta.org.uk/project/addressing-barriers-to-heat-pump-adoption/',
  barclays: 'https://www.barclays.co.uk/mortgages/',
  moneysavingexpert: 'https://www.moneysavingexpert.com/',
  'money saving expert': 'https://www.moneysavingexpert.com/',
  'citizens advice': 'https://www.citizensadvice.org.uk/consumer/energy/energy-supply/get-help-paying-your-bills/',
  currys: 'https://www.currys.co.uk/search?q=energy+saving',
  wrap: 'https://wrap.org.uk/',
  'restart project': 'https://repair.cafe/en/',
  refill: 'https://www.refill.org.uk/',
  vinted: 'https://www.vinted.co.uk/',
}

/** Host-level topic signals — reject when habit copy clearly targets a different subject. */
const OFFER_HOST_TOPIC_CONFLICT: Array<{ hostRe: RegExp; habitRe: RegExp }> = [
  {
    hostRe: /eurostar\.com/i,
    habitRe: /\b(?:e-?bike|ebike|cycle\s+to\s+work|salary.?sacrifice|motorway|cruise|fuel|60mph|driving|car\b)/i,
  },
  {
    hostRe: /mcscertified\.com/i,
    habitRe: /\b(?:e-?bike|ebike|food|meal|shower|kettle|dishwasher)\b/i,
  },
  {
    hostRe: /backmarket\.co/i,
    habitRe: /\b(?:food|meal|shower|water|insulation|boiler|heat\s*pump)\b/i,
  },
]

function habitTopicText(h: RockHabit): string {
  return `${h.title} ${h.insight} ${h.provider_name}`.trim()
}

/** True when an https URL is a poor match for this habit's headline + insight. */
export function habitTopicConflictsWithOfferUrl(habit: RockHabit, url: string): boolean {
  const text = habitTopicText(habit)
  for (const { hostRe, habitRe } of OFFER_HOST_TOPIC_CONFLICT) {
    if (hostRe.test(url) && habitRe.test(text)) return true
  }
  try {
    const host = new URL(url.trim()).hostname.replace(/^www\./i, '').toLowerCase()
    if (host.includes('eurostar') && /\b(?:e-?bike|ebike|salary.?sacrifice)\b/i.test(text)) return true
    if (host.includes('lovefoodhatewaste') && habit.journey_key === 'tech') return true
    if (host.includes('waterwise') && /\b(?:food|meal|ev\b|battery)\b/i.test(text) && !/\b(?:water|shower|tap|aerator)\b/i.test(text)) {
      return true
    }
  } catch {
    return true
  }
  return false
}

function providerUrlForHabit(h: RockHabit): string | undefined {
  const key = normalizeProviderKey(h.provider_name)
  return ROCK_PROVIDER_OFFER_URLS[key]
}

/** Resolve a trusted https offer URL aligned with habit title, insight, and provider. */
export function resolveRockHabitLearnUrl(h: RockHabit): string {
  const explicit = h.learn_url?.trim()
  if (explicit?.startsWith('https://') && !habitTopicConflictsWithOfferUrl(h, explicit)) {
    return sanitizeZoneOfferUrl(explicit, h.journey_key)
  }

  const slugUrl = ROCK_SLUG_OFFER_URLS[h.slug]
  if (slugUrl && !habitTopicConflictsWithOfferUrl(h, slugUrl)) {
    return sanitizeZoneOfferUrl(slugUrl, h.journey_key)
  }

  const providerUrl = providerUrlForHabit(h)
  if (providerUrl && !habitTopicConflictsWithOfferUrl(h, providerUrl)) {
    return sanitizeZoneOfferUrl(providerUrl, h.journey_key)
  }

  const journeyFallback = trustedUrlForJourney(h.journey_key)
  if (!habitTopicConflictsWithOfferUrl(h, journeyFallback)) {
    return sanitizeZoneOfferUrl(journeyFallback, h.journey_key)
  }

  const safe =
    providerUrl ??
    slugUrl ??
    explicit ??
    'https://www.gov.uk/help-with-your-bills'
  return sanitizeZoneOfferUrl(safe, h.journey_key)
}

/** CI — provider label should match CTA host (GOV.UK, National Rail, etc.). */
export function rockHabitProviderMatchesUrl(habit: RockHabit, url: string): boolean {
  if (habitTopicConflictsWithOfferUrl(habit, url)) return false

  const provider = habit.provider_name.trim().toLowerCase()
  const fromUrlLabel = (offerProviderFromHandoffUrl(url) ?? '').toLowerCase()
  if (!fromUrlLabel) return false

  const provKey = provider.replace(/[^a-z0-9]+/g, '')
  const urlKey = fromUrlLabel.replace(/[^a-z0-9]+/g, '')
  if (provKey.length >= 2 && urlKey.length >= 2) {
    if (provKey.includes(urlKey) || urlKey.includes(provKey)) return true
  }

  let host = ''
  try {
    host = new URL(url.trim()).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return false
  }
  const hostCore = host.split('.')[0]?.replace(/[^a-z0-9]/g, '') ?? ''

  const aliases: Array<[RegExp, RegExp]> = [
    [/gov\.uk/i, /gov|uk government/],
    [/energysavingtrust/i, /est|energy saving trust/],
    [/theaa\.com/i, /^aa$/],
    [/rac\.co/i, /^rac$/],
    [/railcard|nationalrail/i, /national rail|railcard/],
    [/moneysavingexpert/i, /money saving expert|moneysavingexpert/],
    [/waterwise/i, /waterwise/],
    [/which\.co/i, /which/],
    [/bbcgoodfood/i, /bbc good food|bbc/],
    [/ninjakitchen/i, /ninja/],
    [/sony\.co/i, /sony/],
    [/whogivesacrap/i, /who gives a crap/],
    [/philips/i, /philips/],
    [/ariel/i, /ariel/],
    [/riverford/i, /riverford/],
    [/oxfam/i, /oxfam/],
    [/bosch/i, /bosch/],
    [/vinted/i, /vinted/],
    [/refill\.org/i, /^refill$/],
    [/rhs\.org/i, /^rhs$/],
    [/britishgas/i, /british gas/],
    [/nesta\.org/i, /nesta/],
    [/barclays/i, /barclays/],
    [/ofgem/i, /ofgem/],
    [/citizensadvice/i, /citizens advice/],
    [/johnlewis/i, /john lewis/],
    [/whirlpool/i, /whirlpool/],
    [/hotpoint/i, /hotpoint/],
    [/morphyrichards/i, /morphy richards/],
    [/levi/i, /levi/],
    [/hp\.com|support\.hp/i, /^hp$/],
    [/ifixit/i, /ifixit/],
    [/octopus\.energy/i, /octopus/],
    [/tado\.com/i, /tado/],
    [/iamroadsmart/i, /iam roadsmart/],
    [/repair\.cafe/i, /restart project|repair cafe/],
    [/tesco/i, /tesco/],
    [/royalmail/i, /royal mail/],
    [/microsoft/i, /microsoft/],
    [/google/i, /google/],
    [/tesla/i, /tesla/],
    [/rockwool/i, /rockwool/],
    [/mighton/i, /mighton/],
    [/nest\.com/i, /^nest$/],
    [/screwfix/i, /screwfix/],
    [/lovefoodhatewaste/i, /love food hate waste/],
    [/wrap\.org/i, /^wrap$/],
    [/backmarket/i, /backmarket/],
    [/gov\.uk\/library/i, /libraries/],
    [/gov\.uk/i, /^libraries$/],
  ]

  for (const [hostRe, provRe] of aliases) {
    if (hostRe.test(host) && provRe.test(provider)) return true
  }

  const tokens = provider.split(/[^a-z0-9]+/).filter((t) => t.length >= 3)
  for (const token of tokens) {
    if (hostCore.includes(token) || host.includes(token)) return true
  }

  return hostCore.length >= 4 && provKey.startsWith(hostCore.slice(0, 4))
}
