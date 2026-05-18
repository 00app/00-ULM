import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'
import { getDiscoveryRecommendation } from '@/lib/brains/recommendations'
import { buildAchievementDiscoveryCard } from '@/lib/zone/achievementDiscoveryCard'
import {
  getJourneyAnswerRowId,
  persistDiscoveryInjection,
} from '@/lib/db/neon'
import { isDeepLinkedUkOfferUrl, shieldUrlPair } from '@/lib/zone/urlShield'
import type { ZoneTipCard } from '@/lib/logic/zone'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeParentAnswerId(raw: string | null | undefined): string | null {
  const id = typeof raw === 'string' ? raw.trim() : ''
  if (!id || !UUID_RE.test(id)) return null
  return id
}

export type ResearchCitationLike = { url?: string; source_name?: string; snippet?: string }

/** `lifestyle_mode: shift` or `mode: lifestyle_shift` from Hermes / Solo Focus. */
export function isLifestyleShiftMode(body: Record<string, unknown>): boolean {
  const lifestyleMode = String(body.lifestyle_mode ?? '').trim().toLowerCase()
  const mode = String(body.mode ?? '').trim().toLowerCase()
  return (
    lifestyleMode === 'shift' ||
    lifestyleMode === 'lifestyle_shift' ||
    mode === 'lifestyle_shift' ||
    mode === 'shift'
  )
}

export function pickPrimaryResearchUrl(citations: ResearchCitationLike[]): string | null {
  for (const c of citations) {
    const u = typeof c.url === 'string' ? c.url.trim() : ''
    if (isDeepLinkedUkOfferUrl(u)) return u
  }
  for (const c of citations) {
    const u = typeof c.url === 'string' ? c.url.trim() : ''
    if (u.startsWith('https://')) return u
  }
  return null
}

export function headlineFromTriggerResearch(
  markdown: string,
  citations: ResearchCitationLike[]
): string {
  const md = markdown.trim()
  const h1 = md.match(/^#\s+(.+)$/m)?.[1]?.trim()
  if (h1 && h1.length >= 8) return h1.slice(0, 140)
  const h2 = md.match(/^##\s+(.+)$/m)?.[1]?.trim()
  if (h2 && h2.length >= 8) return h2.slice(0, 140)
  const line = md
    .split('\n')
    .map((l) => l.replace(/^#+\s*/, '').trim())
    .find((l) => l.length >= 16 && !l.startsWith('Postcode:'))
  if (line) return line.slice(0, 140)
  const name = citations.find((c) => c.source_name?.trim())?.source_name?.trim()
  if (name) return name.slice(0, 140)
  return 'Your pattern shift'
}

export type ScrapeSyncAchievementResult = {
  url_shield: {
    ok: boolean
    retry_recommended: boolean
    offer_url: string
    source_url: string
  }
  achievement_card: ZoneTipCard | null
  persisted: boolean
  parent_answer_id: string | null
}

export function urlShieldFromCitations(
  citations: ResearchCitationLike[],
  journeyKey: JourneyId = 'home'
): ScrapeSyncAchievementResult['url_shield'] {
  const rawUrl = pickPrimaryResearchUrl(citations)
  const { offerUrl, sourceUrl } = shieldUrlPair(rawUrl, rawUrl, journeyKey)
  const urlOk = rawUrl != null && isDeepLinkedUkOfferUrl(rawUrl)
  return {
    ok: urlOk,
    retry_recommended: !urlOk,
    offer_url: offerUrl,
    source_url: sourceUrl,
  }
}

export async function maybeBirthAchievementFromScrapeSync(params: {
  body: Record<string, unknown>
  userId: string | null
  category: string
  loopQuestionId: string
  loopAnswer: string
  markdown: string
  citations: ResearchCitationLike[]
}): Promise<ScrapeSyncAchievementResult | null> {
  const wantAchievement =
    params.body.is_achievement_card === true ||
    String(params.body.is_achievement_card ?? '').toLowerCase() === 'true'
  if (!wantAchievement) return null

  const journeyKey = (
    JOURNEY_ORDER.includes(params.category as JourneyId) ? params.category : 'home'
  ) as JourneyId

  const urlShield = urlShieldFromCitations(params.citations, journeyKey)
  const urlOk = urlShield.ok

  let parentAnswerId = normalizeParentAnswerId(
    typeof params.body.parent_answer_id === 'string' ? params.body.parent_answer_id : null
  )

  const rec =
    params.loopQuestionId && params.loopAnswer
      ? getDiscoveryRecommendation(journeyKey, params.loopQuestionId, params.loopAnswer)
      : null

  const title =
    rec?.headline?.trim() ||
    headlineFromTriggerResearch(params.markdown, params.citations)
  const bodyCopy = rec?.body?.trim() || params.markdown.replace(/^#+\s+/gm, '').trim().slice(0, 800)

  const card = buildAchievementDiscoveryCard({
    journeyId: journeyKey,
    questionId: params.loopQuestionId || 'lifestyle_shift_pattern',
    answerValue: params.loopAnswer || 'shift',
    title,
    body: bodyCopy || null,
    offerUrl: urlOk ? urlShield.offer_url : null,
  })

  let persisted = false
  if (params.userId) {
    if (!parentAnswerId && params.loopQuestionId && params.loopAnswer) {
      parentAnswerId = await getJourneyAnswerRowId(
        params.userId,
        journeyKey,
        params.loopQuestionId
      ).catch(() => null)
    }
    await persistDiscoveryInjection(params.userId, card.id, card, 'hermes_lifestyle_shift', {
      journey_key: journeyKey,
      question_id: params.loopQuestionId || 'lifestyle_shift_pattern',
      answer_value: params.loopAnswer,
      is_achievement_card: true,
      parent_answer_id: parentAnswerId,
      lifestyle_mode: 'lifestyle_shift',
    })
    persisted = true
  }

  return {
    url_shield: urlShield,
    achievement_card: card,
    persisted,
    parent_answer_id: parentAnswerId,
  }
}
