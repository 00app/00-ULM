/**
 * Sanitize scraped / agent markdown before UI or storage (ZeroHunter, Firecrawl).
 */

const STRIP_TAGS = /<[^>]*>/g
const CTRL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g

export function sanitizeAgentMarkdown(raw: string, maxLen = 8000): string {
  let s = typeof raw === 'string' ? raw : ''
  s = s.replace(STRIP_TAGS, '')
  s = s.replace(/\]\([^)]*\)/g, ']') // strip markdown links target
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  s = s.replace(CTRL, '')
  s = s.replace(/javascript:/gi, '')
  s = s.replace(/on\w+\s*=/gi, '')
  return s.trim().slice(0, maxLen)
}

/** Solo Focus display — strip markdown emphasis, headings, and list ordinals for plain prose. */
export function stripMarkdownForProseDisplay(raw: string, maxLen = 1200): string {
  let s = sanitizeAgentMarkdown(raw, maxLen)
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1')
  s = s.replace(/\*([^*]+)\*/g, '$1')
  s = s.replace(/^#{1,6}\s+/gm, '')
  s = s.replace(/^\s*\d+\.\s+/gm, '')
  s = s.replace(/^\s*[-*•]\s+/gm, '')
  s = s.replace(/\s+/g, ' ').trim()
  return s.slice(0, maxLen)
}
