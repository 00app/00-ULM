/**
 * Like/source metadata for Zai replies — layout turn rules live in `lib/zai/chatRules.ts`.
 */
import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'
import { ROUTES } from '@/lib/routes'
import type { AskZaiContext } from '@/lib/expandStorage'
import { inferZaiCtaLabel } from '@/lib/zai/resolveZaiLikeHandoff'
import { pickFirstHttpUrl } from '@/lib/zone/verifiedRevenue'
import { ZAI_FALLBACK_NEEDS_CONTEXT } from '@/lib/zai/chatBoundaries'

export type ZaiChatMeta = {
  likeId: string
  likeTitle: string
  savingsGbp: number
  journeyKey: JourneyId | string
  sourceUrl?: string
  offerUrl?: string
  ctaLabel?: string
  answerHref?: string
  answerLabel?: string
  showLike: boolean
}

export function zaiLikeIdFromText(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 48)
  return `zai-like-${slug || 'tip'}`
}

export function extractFirstHttpsUrl(text: string): string | undefined {
  const m = text.match(/https?:\/\/[^\s)\]]+/i)
  return m?.[0]?.replace(/[.,;]+$/, '')
}

export function looksLikeRecommendation(text: string): boolean {
  const t = text.toLowerCase()
  if (t.length < 24) return false
  return (
    /£\d/.test(t) ||
    /\b(ev|heat pump|tariff|rail|grant|switch|save|solar|insulat)\b/.test(t) ||
    /\b(try|check|book|compare|eligible)\b/.test(t)
  )
}

/** Footer CTA under a Zai reply — states profile destination + question. */
export function formatProfileAnswerLinkLabel(questionOrHint: string): string {
  const raw = questionOrHint.trim()
  if (!raw) return 'Open profile'
  const sentence = raw.endsWith('?') ? raw : `${raw}?`
  const normalized =
    sentence.charAt(0).toLowerCase() + sentence.slice(1)
  return `Answer in profile: ${normalized}`
}

export function profileAnswerHref(args?: {
  journeyKey?: string
  questionId?: string
  returnTo?: string
}): string {
  const params = new URLSearchParams()
  const jid = args?.journeyKey?.trim()
  const qid = args?.questionId?.trim()
  const returnTo = args?.returnTo?.trim() || ROUTES.ZAI
  if (jid) params.set('journey', jid)
  if (qid) params.set('q', qid)
  if (returnTo) params.set('returnTo', returnTo)
  const qs = params.toString()
  return qs ? `${ROUTES.PROFILE}?${qs}` : ROUTES.PROFILE
}

export function findProfileAnswerLink(
  journeyAnswers?: Record<string, Record<string, string>>
): { href: string; label: string } | null {
  if (!journeyAnswers) return null
  for (const jid of JOURNEY_ORDER) {
    const row = journeyAnswers[jid]
    if (!row) continue
    const entries = Object.entries(row).filter(([, v]) => String(v).trim().length > 0)
    if (entries.length === 0) continue
    const [qid, val] = entries[entries.length - 1]!
    const label = String(val).trim().slice(0, 40)
    return {
      href: profileAnswerHref({ journeyKey: jid, questionId: qid }),
      label: formatProfileAnswerLinkLabel(`update your ${jid} answer (${label})`),
    }
  }
  return null
}

export function metaFromAskZaiContext(
  ctx: AskZaiContext,
  journeyAnswers?: Record<string, Record<string, string>>
): ZaiChatMeta | undefined {
  const title =
    ctx.shift_title?.trim() || ctx.question?.trim() || ctx.category?.trim() || 'zai tip'
  const likeId = zaiLikeIdFromText(`${ctx.category}-${title}`)
  const savingsGbp = Number.parseFloat(ctx.personalSpend.replace(/[^\d.]/g, '')) || 0
  const offerUrl = pickFirstHttpUrl(ctx.source_url, ctx.scraped_source)
  const sourceUrl = offerUrl
  const ctaLabel = inferZaiCtaLabel(ctx.category, title, offerUrl)
  const profileFallback = findProfileAnswerLink(journeyAnswers)
  const questionLabel = ctx.journey_question_label?.trim()
  const answerLabel = questionLabel
    ? formatProfileAnswerLinkLabel(questionLabel)
    : profileFallback?.label
  const answerHref = questionLabel
    ? profileAnswerHref({ journeyKey: ctx.category })
    : profileFallback?.href
  return {
    likeId,
    likeTitle: title.slice(0, 120),
    savingsGbp,
    journeyKey: ctx.category || 'home',
    sourceUrl,
    offerUrl,
    ctaLabel,
    answerHref: answerLabel ? answerHref : undefined,
    answerLabel,
    showLike: true,
  }
}

/** When Zai says it needs postcode/profile context, give the message an actual way to fix
 * that instead of leaving it as a dead end — link straight to the profile. */
export function metaForNeedsContextReply(text: string): ZaiChatMeta | undefined {
  if (text.trim() !== ZAI_FALLBACK_NEEDS_CONTEXT) return undefined
  return {
    likeId: zaiLikeIdFromText('needs-profile-context'),
    likeTitle: 'finish your profile',
    savingsGbp: 0,
    journeyKey: 'home',
    answerHref: ROUTES.PROFILE,
    answerLabel: 'Finish your profile',
    showLike: false,
  }
}

export function metaFromZaiReply(
  text: string,
  journeyAnswers?: Record<string, Record<string, string>>
): ZaiChatMeta | undefined {
  const needsContext = metaForNeedsContextReply(text)
  if (needsContext) return needsContext
  if (!looksLikeRecommendation(text)) return undefined
  const likeTitle = text.split(/[.!?]/)[0]?.trim().slice(0, 100) || 'zai pick'
  const moneyMatch = text.match(/£\s*([\d,]+)/)
  const savingsGbp = moneyMatch ? Number.parseInt(moneyMatch[1]!.replace(/,/g, ''), 10) : 0
  const offerUrl = extractFirstHttpsUrl(text)
  const sourceUrl = offerUrl
  const ctaLabel = inferZaiCtaLabel('home', likeTitle, offerUrl)
  const profileLink = findProfileAnswerLink(journeyAnswers)
  return {
    likeId: zaiLikeIdFromText(likeTitle),
    likeTitle,
    savingsGbp: Number.isFinite(savingsGbp) ? savingsGbp : 0,
    journeyKey: 'home',
    sourceUrl,
    offerUrl,
    ctaLabel,
    answerHref: profileLink?.href,
    answerLabel: profileLink?.label,
    showLike: true,
  }
}

/** Merge Solo Focus / Ask context meta with streamed reply URLs and savings. */
export function mergeZaiChatMeta(
  base: ZaiChatMeta | undefined,
  reply: ZaiChatMeta | undefined
): ZaiChatMeta | undefined {
  if (!base && !reply) return undefined
  if (!base) return reply
  if (!reply) return base
  const offerUrl = pickFirstHttpUrl(reply.offerUrl, reply.sourceUrl, base.offerUrl, base.sourceUrl)
  const journeyKey = base.journeyKey !== 'home' ? base.journeyKey : reply.journeyKey
  return {
    ...base,
    savingsGbp: reply.savingsGbp > 0 ? reply.savingsGbp : base.savingsGbp,
    journeyKey,
    sourceUrl: offerUrl ?? base.sourceUrl ?? reply.sourceUrl,
    offerUrl: offerUrl ?? base.offerUrl ?? reply.offerUrl,
    ctaLabel: inferZaiCtaLabel(String(journeyKey), base.likeTitle, offerUrl),
    answerHref: base.answerHref ?? reply.answerHref,
    answerLabel: base.answerLabel ?? reply.answerLabel,
    showLike: base.showLike || reply.showLike,
  }
}
