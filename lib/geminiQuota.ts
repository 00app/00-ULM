/**
 * Gemini free-tier quota tracking.
 * When the API returns 429/529 (resource exhausted), we set a flag so OpenClaw
 * stops using Gemini and falls back to scrape-only (UK defaults / scraped_summary).
 * Flag resets after 24 hours so we retry Gemini next day.
 */

const QUOTA_EXCEEDED_KEY = 'gemini_quota_exceeded_at'
const RESET_AFTER_MS = 24 * 60 * 60 * 1000 // 24 hours

function getStorage(): { at: number } {
  if (typeof globalThis !== 'undefined' && (globalThis as any).__geminiQuota) {
    return (globalThis as any).__geminiQuota
  }
  const store = { at: 0 }
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).__geminiQuota = store
  }
  return store
}

export function setGeminiQuotaExceeded(): void {
  const s = getStorage()
  s.at = Date.now()
}

export function isGeminiQuotaExceeded(): boolean {
  const s = getStorage()
  if (s.at === 0) return false
  return Date.now() - s.at < RESET_AFTER_MS
}
