/**
 * UK subscription services and their plans, for the ask-first subscriptions card.
 *
 * Mechanical truth: a plan carries a list price only where it is confirmed by the provider or by
 * two independent sources that agree, with the date it was checked. Where sources disagree (Netflix
 * in October 2026 is quoted at three different Premium prices) the price is null and the card asks
 * the person what they pay instead of guessing. A null price is unknown, never £0.
 *
 * Update: re-check every price at least quarterly, and whenever a provider announces a rise.
 */

export type SubscriptionKind = 'video' | 'music' | 'bundle' | 'shopping' | 'fitness' | 'other'

export type SubscriptionPlan = {
  id: string
  label: string
  /** Monthly list price in pence, or null when no reliable source pins it down. */
  monthlyPence: number | null
}

export type SubscriptionService = {
  id: string
  name: string
  kind: SubscriptionKind
  plans: SubscriptionPlan[]
  /** Where the person manages or cancels the subscription (provider's own page). */
  manageUrl: string | null
  /** Citation for the plan prices above; null when no plan has a price. */
  priceSource: { name: string; url: string; checkedOn: string } | null
}

const SPOTIFY_SOURCE = {
  name: 'Selectra UK Spotify price guide (updated 22 Oct 2026), matching snoozeit.co.uk',
  url: 'https://selectra.co.uk/tv-broadband/guides/streaming/spotify',
  checkedOn: '2026-10-23',
}

const DISNEY_SOURCE = {
  name: 'ISPreview, Disney+ UK prices from 14 Oct 2026 (existing monthly subscribers from 18 Nov 2026)',
  url: 'https://www.ispreview.co.uk/index.php/2026/10/disneys-internet-video-streaming-service-hikes-uk-prices-for-2026.html',
  checkedOn: '2026-10-23',
}

const AMAZON_SOURCE = {
  name: 'About Amazon UK, Prime Video cost and what is included',
  url: 'https://www.aboutamazon.co.uk/news/entertainment/everything-you-need-to-know-about-prime-video',
  checkedOn: '2026-10-23',
}

export const SUBSCRIPTION_SERVICES: SubscriptionService[] = [
  {
    id: 'netflix',
    name: 'Netflix',
    kind: 'video',
    plans: [
      { id: 'ads', label: 'Standard with adverts', monthlyPence: null },
      { id: 'standard', label: 'Standard', monthlyPence: null },
      { id: 'premium', label: 'Premium', monthlyPence: null },
    ],
    manageUrl: 'https://www.netflix.com/account',
    priceSource: null,
  },
  {
    id: 'spotify',
    name: 'Spotify',
    kind: 'music',
    plans: [
      { id: 'student', label: 'Student', monthlyPence: 599 },
      { id: 'individual', label: 'Individual', monthlyPence: 1299 },
      { id: 'duo', label: 'Duo', monthlyPence: 1799 },
      { id: 'family', label: 'Family', monthlyPence: 2199 },
    ],
    manageUrl: 'https://www.spotify.com/uk/account/overview/',
    priceSource: SPOTIFY_SOURCE,
  },
  {
    id: 'disney',
    name: 'Disney+',
    kind: 'video',
    plans: [
      { id: 'ads', label: 'Standard with Ads', monthlyPence: 699 },
      { id: 'standard', label: 'Standard', monthlyPence: 1199 },
      { id: 'premium', label: 'Premium', monthlyPence: 1599 },
    ],
    manageUrl: 'https://www.disneyplus.com/account',
    priceSource: DISNEY_SOURCE,
  },
  {
    id: 'amazon-prime',
    name: 'Amazon Prime',
    kind: 'shopping',
    plans: [{ id: 'monthly', label: 'Monthly', monthlyPence: 899 }],
    manageUrl: 'https://www.amazon.co.uk/mc',
    priceSource: AMAZON_SOURCE,
  },
  {
    id: 'apple-music',
    name: 'Apple Music',
    kind: 'music',
    plans: [
      { id: 'individual', label: 'Individual', monthlyPence: null },
      { id: 'family', label: 'Family', monthlyPence: null },
    ],
    manageUrl: 'https://support.apple.com/en-gb/118428',
    priceSource: null,
  },
  {
    id: 'apple-tv',
    name: 'Apple TV+',
    kind: 'video',
    plans: [{ id: 'standard', label: 'Standard', monthlyPence: null }],
    manageUrl: 'https://support.apple.com/en-gb/118428',
    priceSource: null,
  },
  {
    id: 'apple-one',
    name: 'Apple One',
    kind: 'bundle',
    plans: [
      { id: 'individual', label: 'Individual', monthlyPence: null },
      { id: 'family', label: 'Family', monthlyPence: null },
    ],
    manageUrl: 'https://support.apple.com/en-gb/118428',
    priceSource: null,
  },
  {
    id: 'youtube-premium',
    name: 'YouTube Premium',
    kind: 'video',
    plans: [{ id: 'individual', label: 'Individual', monthlyPence: null }],
    manageUrl: 'https://www.youtube.com/paid_memberships',
    priceSource: null,
  },
  {
    id: 'now',
    name: 'NOW',
    kind: 'video',
    plans: [
      { id: 'entertainment', label: 'Entertainment', monthlyPence: null },
      { id: 'cinema', label: 'Cinema', monthlyPence: null },
      { id: 'sports', label: 'Sports', monthlyPence: null },
    ],
    manageUrl: 'https://help.nowtv.com',
    priceSource: null,
  },
  {
    id: 'gym',
    name: 'Gym or fitness app',
    kind: 'fitness',
    plans: [{ id: 'membership', label: 'Membership', monthlyPence: null }],
    manageUrl: null,
    priceSource: null,
  },
  {
    id: 'other',
    name: 'Something else',
    kind: 'other',
    plans: [{ id: 'plan', label: 'Plan', monthlyPence: null }],
    manageUrl: null,
    priceSource: null,
  },
]

export function subscriptionService(id: string): SubscriptionService | null {
  return SUBSCRIPTION_SERVICES.find((s) => s.id === id) ?? null
}

export function subscriptionPlan(serviceId: string, planId: string | null | undefined): SubscriptionPlan | null {
  const s = subscriptionService(serviceId)
  if (!s || !planId) return null
  return s.plans.find((p) => p.id === planId) ?? null
}
