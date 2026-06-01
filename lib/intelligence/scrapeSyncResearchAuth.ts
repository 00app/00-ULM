import type { NextRequest } from 'next/server'
import { scrapeSyncBearerMatches } from '@/lib/intelligence/scrapeSyncAuth'

/** Firecrawl / repair / force paths — signed-in user or service bearer only (no guest cookie). */
export function scrapeSyncHeavyResearchAllowed(
  sessionUserId: string | null,
  request: NextRequest
): boolean {
  if (sessionUserId) return true
  return scrapeSyncBearerMatches(request)
}
