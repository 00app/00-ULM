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
