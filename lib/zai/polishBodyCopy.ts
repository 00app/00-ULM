import { dedupeLocalityInProse } from '@/lib/brains/zai/prose'
import { sanitizeText } from '@/lib/sanitize'
import { stripZaiChatMarkdown } from '@/lib/zai/chatBoundaries'
import { toZaiBodySentenceCase } from '@/lib/zai/sentenceCase'

/** Client display — sanitize, strip markdown, sentence-case Zai body prose. */
export function polishZaiBodyCopy(text: string): string {
  return toZaiBodySentenceCase(
    stripZaiChatMarkdown(dedupeLocalityInProse(sanitizeText(text)))
  )
}

/** Server /api/zai — same editorial pass without client sanitize. */
export function polishZaiServerBodyCopy(text: string): string {
  return toZaiBodySentenceCase(stripZaiChatMarkdown(dedupeLocalityInProse(text.trim())))
}
