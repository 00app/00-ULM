/**
 * Prose completion + coherence guards for Solo Focus / Zone copy.
 * @version 2026-06-24 — ellipsis, fragment, AI-hedge, variable-leak, truncation signatures.
 */

export const MAX_TRUE_TIP_PARAGRAPH_WORDS = 40
export const MIN_COHERENT_SENTENCE_WORDS = 6
export const MIN_COHERENT_PARAGRAPH_WORDS = 20

const AI_HEDGE_RE =
  /\b(?:as an ai|i cannot|i should note|please note|it is important to|it's worth noting)\b/i

const VARIABLE_LEAK_RE =
  /£\{[^}]+\}|\{postcode\}|\{amount\}|\bundefined\b|\bnull\b|\bNaN\b|\[object Object\]/i

const TRUNCATION_END_RE = /\b(?:and|or|but|with|for|in|of|the)$/i

/** Returns true when text ends with truncation signatures (ellipsis, dangling words, open paren). */
export function isTruncatedSentence(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (t.endsWith('...') || t.endsWith('…')) return true
  if (/\([^)]*$/.test(t)) return true
  const lastWord = t.split(/\s+/).pop()?.replace(/[.!?,;:]+$/, '') ?? ''
  if (lastWord.length > 0 && lastWord.length < 3) return true
  if (TRUNCATION_END_RE.test(t.replace(/[.!?…]+$/, '').trim())) return true
  return false
}

function isCompleteSentence(sentence: string): boolean {
  const s = sentence.trim()
  if (!s) return false
  if (isTruncatedSentence(s)) return false
  if (s.endsWith(',')) return false
  const words = s.split(/\s+/).filter(Boolean)
  if (words.length < MIN_COHERENT_SENTENCE_WORDS) return false
  if (AI_HEDGE_RE.test(s)) return false
  if (VARIABLE_LEAK_RE.test(s)) return false
  return /[.!?]$/.test(s)
}

function sentenceRepeatsNounPhrase(sentence: string): boolean {
  const tokens = sentence
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4)
  const seen = new Map<string, number>()
  for (const t of tokens) {
    const n = (seen.get(t) ?? 0) + 1
    if (n > 2) return true
    seen.set(t, n)
  }
  return false
}

/** Paragraph gate — 2+ complete sentences, 20–40 words, no ellipsis, no leading conjunction. */
export function isCoherentParagraph(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/^(and|but|or|so|yet)\b/i.test(t)) return false
  if (/^[a-z]/.test(t) && !/^[a-z]+—/.test(t)) {
    /* lowercase start unless em-dash continuation */
    if (!/^\w+—/.test(t)) return false
  }
  const sentences = t
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const complete = sentences.filter(isCompleteSentence)
  if (complete.length < 2) return false
  const wordCount = t.split(/\s+/).filter(Boolean).length
  if (wordCount < MIN_COHERENT_PARAGRAPH_WORDS || wordCount > MAX_TRUE_TIP_PARAGRAPH_WORDS) {
    return false
  }
  if (sentences.some(isTruncatedSentence)) return false
  if (sentences.some(sentenceRepeatsNounPhrase)) return false
  return true
}

export function stripTrailingEllipsis(text: string): string {
  let t = text.trim()
  while (t.endsWith('...') || t.endsWith('…')) {
    t = t.slice(0, -3).trim()
  }
  return t
}

function cleanSentence(sentence: string): string | null {
  let s = stripTrailingEllipsis(sentence.trim())
  if (!s) return null
  if (AI_HEDGE_RE.test(s)) return null
  if (VARIABLE_LEAK_RE.test(s)) return null
  if (sentenceRepeatsNounPhrase(s)) return null
  if (s.endsWith(',')) return null
  const words = s.split(/\s+/).filter(Boolean)
  if (words.length < MIN_COHERENT_SENTENCE_WORDS) return null
  if (isTruncatedSentence(s)) {
    if (/[.!?]/.test(s)) {
      const parts = s.split(/(?<=[.!?])\s+/).filter((p) => !isTruncatedSentence(p))
      s = parts.join(' ').trim()
    } else {
      return null
    }
  }
  return s || null
}

export function clampWordsCompleteSentence(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return text.trim()
  let slice = words.slice(0, maxWords).join(' ')
  if (!/[.!?]$/.test(slice)) {
    const lastStop = slice.lastIndexOf('.')
    if (lastStop > 20) slice = slice.slice(0, lastStop + 1)
  }
  return stripTrailingEllipsis(slice)
}

/** Strip ellipsis sentences and fragments from a paragraph block. */
export function sanitizeProseParagraphs(text: string): string {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => {
      const sentences = p
        .split(/(?<=[.!?])\s+/)
        .map(cleanSentence)
        .filter((s): s is string => Boolean(s))
      return sentences.join(' ').trim()
    })
    .filter(Boolean)
  return paragraphs.join('\n\n').trim()
}
