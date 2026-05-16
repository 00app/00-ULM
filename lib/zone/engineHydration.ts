/** Intelligence-loop hydration phases shown on the Zone gate while scrape-sync runs. */
export type ZoneEngineStatus = 'idle' | 'scraping' | 'structuring' | 'saving'

export const ZONE_ENGINE_HYDRATION_LABELS: Record<Exclude<ZoneEngineStatus, 'idle'>, string> = {
  scraping: 'SCRAPING FIRECRAWL',
  structuring: 'CONNECTING GEMINI',
  saving: 'ACCESSING NEON DB',
}

/** Timed phase hints while the server runs Firecrawl → Gemini → Neon (single request). */
export function scheduleZoneEngineHydrationPhases(
  onPhase: (status: Exclude<ZoneEngineStatus, 'idle'>) => void
): () => void {
  const t1 = window.setTimeout(() => onPhase('structuring'), 2200)
  const t2 = window.setTimeout(() => onPhase('saving'), 5200)
  return () => {
    window.clearTimeout(t1)
    window.clearTimeout(t2)
  }
}
