/**
 * EU PVGIS — solar yield estimate (free tier). Requires lat/lon from postcode geocode.
 * @see https://joint-research-centre.ec.europa.eu/pvgis-photovoltaic-geographical-information-system_en
 */

export type PvgisSolarSnapshot = {
  found: boolean
  annualKwhEstimate?: number
  /** Normalized 0–1 yield factor for deterministic £ scaling. */
  yieldFactor: number
}

export async function fetchPvgisSolarEstimate(params: {
  postcode: string
  lat?: number
  lon?: number
}): Promise<PvgisSolarSnapshot> {
  const empty: PvgisSolarSnapshot = { found: false, yieldFactor: 1 }
  if (params.lat == null || params.lon == null || !Number.isFinite(params.lat)) return empty

  const peakPower = 4
  /* PVcalc, not seriescalc — seriescalc returns raw hourly records (166k+ rows, ~15MB) with no
     outputs.totals/monthly at all, so annual was always 0/undefined here and this call always
     returned found:false. PVcalc is the correct endpoint for an annual PV yield estimate, and
     nests the totals one level deeper than this file originally assumed (verified live against
     the real API): outputs.totals.fixed.E_y / outputs.monthly.fixed[].E_m, not
     outputs.totals.E_y / outputs.monthly[].E_m. */
  const url = `https://re.jrc.ec.europa.eu/api/PVcalc?lat=${params.lat}&lon=${params.lon}&peakpower=${peakPower}&loss=14&outputformat=json`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return empty
    const json = (await res.json()) as {
      outputs?: { monthly?: { fixed?: { E_m?: number }[] }; totals?: { fixed?: { E_y?: number } } }
    }
    const annual =
      json?.outputs?.totals?.fixed?.E_y ??
      (json?.outputs?.monthly?.fixed ?? []).reduce((s, m) => s + (m.E_m ?? 0), 0)
    if (!annual || !Number.isFinite(annual)) return empty
    const yieldFactor = Math.min(1.35, Math.max(0.85, annual / 3800))
    return { found: true, annualKwhEstimate: Math.round(annual), yieldFactor }
  } catch {
    return empty
  }
}
