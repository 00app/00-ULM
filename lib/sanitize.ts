/**
 * Sanitize HTML for safe display (Zai responses). Prevents XSS.
 * Allows only safe inline formatting; strips script, iframe, event handlers.
 */

const ALLOWED_TAGS = new Set(['b', 'i', 'em', 'strong', 'br', 'p', 'span', 'a'])
const ALLOWED_ATTRS = new Set(['href', 'title'])

function isSafeUrl(href: string): boolean {
  try {
    const u = new URL(href, 'https://example.com')
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') return ''
  if (typeof document === 'undefined') return escapeHtml(html)
  const doc = new DOMParser().parseFromString(html, 'text/html')

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? '')
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as Element
    const tag = el.tagName.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) {
      return Array.from(node.childNodes).map(walk).join('')
    }
    let out = `<${tag}`
    if (tag === 'a') {
      const href = el.getAttribute('href')
      if (href && isSafeUrl(href)) out += ` href="${escapeAttr(href)}"`
      const title = el.getAttribute('title')
      if (title) out += ` title="${escapeAttr(title)}"`
    }
    out += '>'
    out += Array.from(node.childNodes).map(walk).join('')
    out += `</${tag}>`
    return out
  }

  const body = doc.body
  return Array.from(body.childNodes).map(walk).join('').trim() || escapeHtml(html)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;')
}

/** Strip potential injection patterns from Gemini-streamed strings (2026 stability). */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /disregard\s+your\s+(system\s+)?(instructions?|prompt)/gi,
  /you\s+are\s+now\s+/gi,
  /new\s+instructions?\s*:/gi,
  /system\s*:\s*/gi,
  /\[INST\]|\[\/INST\]|<<SYS>>|<<\/SYS>>/gi,
  /<\|[a-z_]+\|>/g,
]

export function sanitizeGeminiStream(text: string): string {
  if (typeof text !== 'string') return ''
  let out = text
  for (const re of INJECTION_PATTERNS) {
    out = out.replace(re, '')
  }
  return out.trim()
}

/** Plain-text fallback: strip any HTML, remove injection patterns, escape. Use for Zai display. */
export function sanitizeText(text: string): string {
  if (typeof text !== 'string') return ''
  const noHtml = text.replace(/<[^>]*>/g, '')
  const noInjection = sanitizeGeminiStream(noHtml)
  return escapeHtml(noInjection)
}
