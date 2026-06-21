import type { RockHabit } from '@/lib/rock/types'
import { sendTwilioSms, type SendSmsResult } from '@/lib/messaging/twilioClient'
import { pickRockTipsForSms } from '@/lib/messaging/pickRockTipsForSms'
import { clampRockTipHeadline } from '@/lib/soloFocusCopy'
import { sanitizeZoneOfferUrl } from '@/lib/zone/offerUrlGuard'
import { trustedUrlForJourney } from '@/lib/zone/trustedJourneyUrls'

const SMS_MAX = 1600
const SMS_RULE = '------------------'

export type SignupSmsItem = {
  title: string
  url?: string
  gbp?: number
}

export type SignupZoneSmsInput = {
  userName?: string
  /** Legacy slug list — used when `tips` omitted. */
  tipSlugs?: string[]
  tips?: SignupSmsItem[]
  recommendations?: Array<string | SignupSmsItem>
}

export function normalizeSmsUrl(raw: string | undefined | null): string | undefined {
  const u = raw?.trim()
  if (!u?.startsWith('https://')) return undefined
  return u
}

/** Best https offer/source URL from a journey mother tile. */
export function resolveJourneyCardUrl(item: {
  cta?: { url?: string }
  claimOfferUrl?: string
  partner_link?: string
  actions?: { actionUrl?: string; learnUrl?: string }
  source?: string
}): string | undefined {
  for (const raw of [
    item.cta?.url,
    item.claimOfferUrl,
    item.partner_link,
    item.actions?.actionUrl,
    item.actions?.learnUrl,
    item.source,
  ]) {
    const url = normalizeSmsUrl(raw)
    if (url) return url
  }
  return undefined
}

function firstName(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return 'there'
  return trimmed.split(/\s+/)[0] ?? 'there'
}

function cleanLine(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

function rockTipUrl(h: RockHabit): string | undefined {
  const raw = (h.learn_url?.trim() || trustedUrlForJourney(h.journey_key) || '').trim()
  if (!raw) return undefined
  return normalizeSmsUrl(sanitizeZoneOfferUrl(raw, h.journey_key) ?? raw)
}

function normalizeRecommendations(raw: SignupZoneSmsInput['recommendations']): SignupSmsItem[] {
  if (!raw?.length) return []
  const out: SignupSmsItem[] = []
  for (const entry of raw.slice(0, 6)) {
    if (typeof entry === 'string') {
      const title = cleanLine(entry)
      if (title) out.push({ title })
      continue
    }
    const title = cleanLine(entry.title ?? '')
    if (!title) continue
    out.push({ title, url: normalizeSmsUrl(entry.url) })
  }
  return out
}

function resolveSignupTips(input: SignupZoneSmsInput, habits: RockHabit[]): SignupSmsItem[] {
  if (input.tips?.length) {
    return input.tips
      .slice(0, 6)
      .map((t) => ({
        title: cleanLine(t.title ?? ''),
        url: normalizeSmsUrl(t.url),
        gbp: t.gbp,
      }))
      .filter((t) => t.title)
  }
  return habits.map((h) => ({
    title: clampRockTipHeadline(h.title).replace(/\.$/, ''),
    url: rockTipUrl(h),
    gbp: Math.max(0, Math.round(h.money_gbp)),
  }))
}

function formatItemLines(item: SignupSmsItem, includeUrls: boolean): string[] {
  const gbp = item.gbp != null && item.gbp > 0 ? ` — ~£${item.gbp}/yr` : ''
  const lines = [`${item.title}${gbp}`]
  if (includeUrls && item.url) lines.push(item.url)
  return lines
}

function flattenItems(items: SignupSmsItem[], includeUrls: boolean): string[] {
  return items.flatMap((item) => formatItemLines(item, includeUrls))
}

/** Signup SMS — dashed sections; mirrors Zone Today's Tips + Recommendations (with URLs). */
export function buildSignupZoneSmsBody(input: SignupZoneSmsInput, habits: RockHabit[]): string {
  const tipItems = resolveSignupTips(input, habits)
  const recItems = normalizeRecommendations(input.recommendations)

  const build = (tips: SignupSmsItem[], recs: SignupSmsItem[], includeUrls: boolean) => {
    const tipLines = flattenItems(tips, includeUrls)
    const recLines = flattenItems(recs, includeUrls)
    const parts = [
      SMS_RULE,
      `Hello. ${firstName(input.userName)}`,
      SMS_RULE,
      "Today's tips",
      ...(tipLines.length ? tipLines : ['—']),
      '',
      SMS_RULE,
      'Recommendations',
      ...(recLines.length ? recLines : ['—']),
      '',
      SMS_RULE,
      'Peace & Respect.',
      'Zero Zero.',
      'Reply STOP to opt out.',
    ]
    return parts.join('\n')
  }

  const attempts: Array<{ tips: SignupSmsItem[]; recs: SignupSmsItem[]; urls: boolean }> = [
    { tips: tipItems, recs: recItems, urls: true },
    { tips: tipItems.slice(0, 3), recs: recItems.slice(0, 3), urls: true },
    { tips: tipItems.slice(0, 2), recs: recItems.slice(0, 2), urls: true },
    { tips: tipItems.slice(0, 1), recs: recItems.slice(0, 1), urls: true },
    { tips: tipItems.slice(0, 2), recs: recItems.slice(0, 2), urls: false },
    { tips: tipItems.slice(0, 1), recs: recItems.slice(0, 1), urls: false },
  ]

  for (const attempt of attempts) {
    const body = build(attempt.tips, attempt.recs, attempt.urls)
    if (body.length <= SMS_MAX) return body
  }

  return build(tipItems.slice(0, 1), recItems.slice(0, 1), false)
}

export async function sendSignupZoneSms(
  to: string,
  input: SignupZoneSmsInput
): Promise<SendSmsResult & { tipCount?: number; recommendationCount?: number }> {
  const habits = pickRockTipsForSms(input.tipSlugs, 6)
  const body = buildSignupZoneSmsBody(input, habits)
  const result = await sendTwilioSms(to, body)
  const tipCount = (input.tips?.length ? input.tips : habits).slice(0, 6).length
  const recCount = normalizeRecommendations(input.recommendations).length
  return result.ok ? { ...result, tipCount, recommendationCount: recCount } : result
}
