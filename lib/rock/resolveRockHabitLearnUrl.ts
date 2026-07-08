/**
 * Rock habit offer URLs — topic-aligned links; never blind journey fallbacks (e-bike → Eurostar).
 */

import type { RockHabit } from '@/lib/rock/types'
import { offerProviderFromHandoffUrl } from '@/lib/soloFocusSuppliedBy'
import { sanitizeZoneOfferUrl } from '@/lib/zone/offerUrlGuard'
import { trustedUrlForJourney } from '@/lib/zone/trustedJourneyUrls'

/** Slug overrides where journey_key fallback would mismatch habit topic. */
const ROCK_SLUG_OFFER_URLS: Partial<Record<string, string>> = {
  // curtains-dusk (John Lewis), jeans-cold (Levi's), tablet-over-tv (Sony) — left as-is:
  // these block automated checks outright, so live-vs-dead couldn't be confirmed either way.
  'e-bike-scheme': 'https://www.gov.uk/government/publications/cycle-to-work-scheme-implementation-guidance',
  railcard: 'https://www.railcard.co.uk/',
  'speed-cap-60': 'https://www.theaa.com/driving-advice/',
  'cruise-control': 'https://www.iamroadsmart.com/advice/',
  'combine-trips': 'https://www.rac.co.uk/drive/advice/',
  'tyre-pressure': 'https://www.theaa.com/driving-advice/',
  'ev-off-peak': 'https://octopus.energy/smart/',
  'smart-meter': 'https://octopus.energy/smart/',
  'meter-reads': 'https://www.ofgem.gov.uk/',
  'tariff-compare': 'https://www.moneysavingexpert.com/cheapenergyclub/',
  'green-mortgage': 'https://www.barclays.co.uk/mortgages/green-home-mortgage/',
  'microwave-small': 'https://www.which.co.uk/',
  'freezer-defrost': 'https://www.hotpoint.co.uk/support/',
  'slow-cooker': 'https://www.morphyrichards.co.uk/',
  'pan-lids': 'https://www.energysavingtrust.org.uk/',
  'jeans-cold': 'https://www.levi.com/GB/en_GB/blog/article/sustainability/caring-for-your-denim',
  'library-ebooks': 'https://librariesconnected.org.uk/',
  'print-double': 'https://support.hp.com/gb-en/help',
  'curtains-dusk': 'https://www.johnlewis.com/browse/electricals/energy-saving',
  'line-dry-week': 'https://www.whirlpool.co.uk/',
  'pension-esg': 'https://www.which.co.uk/',
  'air-fryer-swap': 'https://www.ninjakitchen.co.uk/',
  'tablet-over-tv': 'https://www.sony.co.uk/electronics/eco',
  'bamboo-tp': 'https://uk.whogivesacrap.org/',
  'led-everywhere': 'https://www.lighting.philips.co.uk/consumer',
  'shower-four-min': 'https://www.waterwise.org.uk/save-water/',
  'wash-30c': 'https://www.ariel.co.uk/',
  'batch-cook': 'https://www.bbcgoodfood.com/',
  'veg-box': 'https://www.riverford.co.uk/',
  'flex-monday': 'https://www.oxfam.org.uk/',
  'dishwasher-full': 'https://www.bosch-home.co.uk/',
  'preloved-fashion': 'https://www.vinted.co.uk/',
  'refill-stores': 'https://www.refill.org.uk/',
  'cylinder-jacket': 'https://www.britishgas.co.uk/',
  'greywater-plants': 'https://www.rhs.org.uk/',
  'heat-pump-check': 'https://www.nesta.org.uk/',
  'direct-debit': 'https://www.citizensadvice.org.uk/consumer/energy/energy-supply/get-help-paying-your-bills/',
}

function normalizeProviderKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

/** Publisher home / advice pages keyed by catalog `provider_name`. */
const ROCK_PROVIDER_OFFER_URLS: Record<string, string> = {
  // tesco, royal mail, sony, tesla — left as-is: these block automated checks outright
  // (Akamai "Access Denied", not a branded 404), so live-vs-dead couldn't be confirmed.
  est: 'https://www.energysavingtrust.org.uk/',
  'energy saving trust': 'https://www.energysavingtrust.org.uk/',
  aa: 'https://www.theaa.com/driving-advice/',
  rac: 'https://www.rac.co.uk/drive/advice/',
  'national rail': 'https://www.railcard.co.uk/',
  'iam roadsmart': 'https://www.iamroadsmart.com/advice/',
  'gov uk': 'https://www.gov.uk/browse/environment-countryside',
  'gov.uk': 'https://www.gov.uk/browse/environment-countryside',
  ofgem: 'https://www.ofgem.gov.uk/',
  octopus: 'https://octopus.energy/',
  nest: 'https://nest.com/uk/support/',
  tado: 'https://www.tado.com/gb-en/',
  philips: 'https://www.lighting.philips.co.uk/consumer',
  waterwise: 'https://www.waterwise.org.uk/save-water/',
  'love food hate waste': 'https://www.lovefoodhatewaste.com/',
  'which?': 'https://www.which.co.uk/',
  'bbc good food': 'https://www.bbcgoodfood.com/',
  riverford: 'https://www.riverford.co.uk/',
  oxfam: 'https://www.oxfam.org.uk/',
  ninja: 'https://www.ninjakitchen.co.uk/',
  sony: 'https://www.sony.co.uk/',
  'who gives a crap': 'https://uk.whogivesacrap.org/',
  screwfix: 'https://www.screwfix.com/',
  bosch: 'https://www.bosch-home.co.uk/',
  ariel: 'https://www.ariel.co.uk/',
  microsoft: 'https://support.microsoft.com/en-gb/windows',
  google: 'https://one.google.com/storage',
  ifixit: 'https://www.ifixit.com/',
  tesco: 'https://www.tesco.com/',
  rhs: 'https://www.rhs.org.uk/',
  'royal mail': 'https://www.royalmail.com/',
  rockwool: 'https://www.rockwool.com/',
  'british gas': 'https://www.britishgas.co.uk/',
  mighton: 'https://www.mightonproducts.com/',
  tesla: 'https://www.tesla.com/en_gb/powerwall',
  nesta: 'https://www.nesta.org.uk/',
  barclays: 'https://www.barclays.co.uk/mortgages/',
  moneysavingexpert: 'https://www.moneysavingexpert.com/',
  'money saving expert': 'https://www.moneysavingexpert.com/',
  'citizens advice': 'https://www.citizensadvice.org.uk/consumer/energy/energy-supply/get-help-paying-your-bills/',
  currys: 'https://www.currys.co.uk/search?q=energy+saving',
  wrap: 'https://wrap.org.uk/',
  'restart project': 'https://therestartproject.org/',
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
    hostRe: /recyclenow/i,
    habitRe: /\b(?:water\s+butt|rainwater|hosepipe|garden\s+water)\b/i,
  },
  {
    hostRe: /wrap\.org/i,
    habitRe: /\b(?:preloved|fashion|clothes|wardrobe|vinted)\b/i,
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

/** Apply a journey-level Neon offer only when it matches the habit topic. */
export function mergeRockHabitWithJourneyOffer(
  habit: RockHabit,
  journeyOfferUrl?: string | null
): RockHabit {
  const url = journeyOfferUrl?.trim()
  if (!url?.startsWith('https://') || habitTopicConflictsWithOfferUrl(habit, url)) {
    return habit
  }
  return { ...habit, learn_url: url }
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
    'https://www.citizensadvice.org.uk/consumer/energy/energy-supply/get-help-paying-your-bills/'
  return sanitizeZoneOfferUrl(safe, h.journey_key)
}

/** CI — provider label should match CTA host (GOV.UK, National Rail, etc.). */
export function rockHabitProviderMatchesUrl(habit: RockHabit, url: string): boolean {
  if (habitTopicConflictsWithOfferUrl(habit, url)) return false

  const provider = habit.provider_name.trim().toLowerCase()
  const provKey = provider.replace(/[^a-z0-9]+/g, '')

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
    [/therestartproject\.org/i, /restart project|repair cafe/],
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

  const fromUrlLabel = (offerProviderFromHandoffUrl(url) ?? '').toLowerCase()
  if (fromUrlLabel) {
    const urlKey = fromUrlLabel.replace(/[^a-z0-9]+/g, '')
    if (provKey.length >= 2 && urlKey.length >= 2) {
      if (provKey.includes(urlKey) || urlKey.includes(provKey)) return true
    }
  }

  const tokens = provider.split(/[^a-z0-9]+/).filter((t) => t.length >= 3)
  for (const token of tokens) {
    if (hostCore.includes(token) || host.includes(token)) return true
  }

  return hostCore.length >= 4 && provKey.startsWith(hostCore.slice(0, 4))
}
