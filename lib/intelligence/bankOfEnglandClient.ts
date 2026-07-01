/**
 * Bank of England — base rate (Bank Rate).
 * Scraped from the BoE statistical database CSV export (free, no key).
 * Falls back to a hardcoded recent value when the fetch fails.
 * @see https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp
 */

const BOE_CSV_URL =
  'https://www.bankofengland.co.uk/boeapps/database/fromshowcolumns.asp?' +
  'Travel=NIxRSx&FromSeries=1&ToSeries=50&DAT=RNG&FD=1&FM=Jan&FY=2025&TD=1&TM=Jul&TY=2026' +
  '&VFD=N&html.x=66&html.y=26&SeriesCodes=IUDBEDR&CSVF=TN&UnitRes=1&XNotes=Y&C=5LK&Action=Go'

// As of July 2026. Updated when live fetch succeeds.
const FALLBACK_RATE = 4.25
const FALLBACK_DATE = '2025-08-01'

export type BoeRateSnapshot = {
  rate: number
  /** ISO date string of most recent change */
  effectiveDate: string
  source: 'boe.api' | 'fallback'
}

let _cached: (BoeRateSnapshot & { fetchedAt: number }) | null = null
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours — rate changes rarely

export async function fetchBoeBaseRate(): Promise<BoeRateSnapshot> {
  if (_cached && Date.now() - _cached.fetchedAt < CACHE_TTL_MS) {
    const { fetchedAt: _, ...snap } = _cached
    return snap
  }

  try {
    const res = await fetch(BOE_CSV_URL, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) throw new Error(`boe ${res.status}`)
    const text = await res.text()

    // CSV rows: "DD Mon YYYY","rate"  — last non-empty data row is current
    const rows = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('"Title"') && !l.startsWith('"Unique'))
    const dataRows = rows.filter((r) => /^\d{2}\s+\w{3}\s+\d{4}/.test(r) || /",/.test(r))

    for (let i = dataRows.length - 1; i >= 0; i--) {
      const parts = dataRows[i].split(',').map((p) => p.replace(/"/g, '').trim())
      const rate = parseFloat(parts[1] ?? '')
      if (!Number.isFinite(rate)) continue
      const rawDate = parts[0] ?? ''
      // Parse "DD Mon YYYY" → ISO
      const parsed = new Date(rawDate)
      const effectiveDate = Number.isNaN(parsed.getTime())
        ? FALLBACK_DATE
        : parsed.toISOString().slice(0, 10)
      const snap: BoeRateSnapshot = { rate, effectiveDate, source: 'boe.api' }
      _cached = { ...snap, fetchedAt: Date.now() }
      return snap
    }
  } catch {
    // fall through
  }

  return { rate: FALLBACK_RATE, effectiveDate: FALLBACK_DATE, source: 'fallback' }
}

/** True when the given savings rate (as %) beats the current BoE base rate. */
export async function isSavingsRateCompetitive(savingsRatePct: number): Promise<boolean> {
  const snap = await fetchBoeBaseRate()
  return savingsRatePct >= snap.rate
}

/** Formatted string for zone copy, e.g. "4.25% (effective 2025-08-01)". */
export function formatBoeRate(snap: BoeRateSnapshot): string {
  return `${snap.rate.toFixed(2)}% (effective ${snap.effectiveDate})`
}
