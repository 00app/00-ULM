/**
 * Like/source metadata for Zai replies — layout turn rules live in `lib/zai/chatRules.ts`.
 */
import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'
import { ROUTES } from '@/lib/routes'
import type { AskZaiContext } from '@/lib/expandStorage'

export type ZaiChatMeta = {
  likeId: string
  likeTitle: string
  savingsGbp: number
  journeyKey: JourneyId | string
  sourceUrl?: string
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
  const sourceUrl =
    typeof ctx.scraped_source === 'string' && ctx.scraped_source.startsWith('http')
      ? ctx.scraped_source
      : undefined
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
    answerHref: answerLabel ? answerHref : undefined,
    answerLabel,
    showLike: true,
  }
}

export function metaFromZaiReply(
  text: string,
  journeyAnswers?: Record<string, Record<string, string>>
): ZaiChatMeta | undefined {
  if (!looksLikeRecommendation(text)) return undefined
  const likeTitle = text.split(/[.!?]/)[0]?.trim().slice(0, 100) || 'zai pick'
  const moneyMatch = text.match(/£\s*([\d,]+)/)
  const savingsGbp = moneyMatch ? Number.parseInt(moneyMatch[1]!.replace(/,/g, ''), 10) : 0
  const sourceUrl = extractFirstHttpsUrl(text)
  const profileLink = findProfileAnswerLink(journeyAnswers)
  return {
    likeId: zaiLikeIdFromText(likeTitle),
    likeTitle,
    savingsGbp: Number.isFinite(savingsGbp) ? savingsGbp : 0,
    journeyKey: 'home',
    sourceUrl,
    answerHref: profileLink?.href,
    answerLabel: profileLink?.label,
    showLike: true,
  }
}
