/**
 * HM Land Registry — Price Paid Data (England & Wales).
 * Free SPARQL endpoint, no API key.
 * @see https://landregistry.data.gov.uk/app/ppd/
 */

const LAND_REGISTRY_SPARQL = 'https://landregistry.data.gov.uk/landregistry/query'

export type LandRegistryPropertyType = 'DETACHED' | 'SEMI' | 'TERRACED' | 'FLAT' | 'OTHER'

export type LandRegistryTenure = 'FREEHOLD' | 'LEASEHOLD' | 'UNKNOWN'

export type PropertyValueBand = 'UNDER_200K' | '200K_500K' | '500K_PLUS'

export type LandRegistrySnapshot = {
  found: boolean
  postcode: string
  lastSalePrice?: number
  lastSaleDate?: string
  propertyType?: LandRegistryPropertyType
  newBuild?: boolean
  tenure?: LandRegistryTenure
  propertyValueBand?: PropertyValueBand
  /** PAON / SAON when house number filter applied. */
  addressMatched?: boolean
}

function formatUkPostcode(compact: string): string {
  const c = compact.replace(/\s+/g, '').toUpperCase()
  if (c.length <= 3) return c
  return `${c.slice(0, -3)} ${c.slice(-3)}`
}

function mapPropertyType(raw: string | undefined): LandRegistryPropertyType | undefined {
  const t = (raw ?? '').trim().toLowerCase()
  if (!t) return undefined
  if (t.includes('detached')) return 'DETACHED'
  if (t.includes('semi')) return 'SEMI'
  if (t.includes('terraced') || t.includes('terrace')) return 'TERRACED'
  if (t.includes('flat') || t.includes('maisonette')) return 'FLAT'
  return 'OTHER'
}

function mapTenure(raw: string | undefined): LandRegistryTenure | undefined {
  const t = (raw ?? '').trim().toLowerCase()
  if (!t) return undefined
  if (t.includes('freehold')) return 'FREEHOLD'
  if (t.includes('leasehold')) return 'LEASEHOLD'
  return 'UNKNOWN'
}

export function derivePropertyValueBand(price: number | undefined): PropertyValueBand | undefined {
  if (price == null || !Number.isFinite(price) || price <= 0) return undefined
  if (price < 200_000) return 'UNDER_200K'
  if (price < 500_000) return '200K_500K'
  return '500K_PLUS'
}

function houseNumberMatchesRow(paon: string | undefined, saon: string | undefined, houseNumber: string): boolean {
  const token = houseNumber.replace(/\s+/g, ' ').trim().toUpperCase()
  if (!token) return true
  const paonU = (paon ?? '').trim().toUpperCase()
  const saonU = (saon ?? '').trim().toUpperCase()
  return paonU === token || paonU.startsWith(`${token} `) || saonU === token || saonU.startsWith(`${token} `)
}

type SparqlBinding = { type?: string; value?: string }

type SparqlRow = Record<string, SparqlBinding>

function bindingString(row: SparqlRow, key: string): string | undefined {
  const v = row[key]?.value
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

function bindingNumber(row: SparqlRow, key: string): number | undefined {
  const raw = bindingString(row, key)
  if (!raw) return undefined
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : undefined
}

async function runLandRegistrySparql(postcodeSpaced: string): Promise<SparqlRow[]> {
  const query = `
PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?amount ?date ?propertyType ?newBuild ?estateType ?paon ?saon
WHERE {
  ?addr lrcommon:postcode "${postcodeSpaced}"^^xsd:string .
  ?transx lrppi:propertyAddress ?addr ;
          lrppi:pricePaid ?amount ;
          lrppi:transactionDate ?date .
  OPTIONAL { ?transx lrppi:propertyType/skos:prefLabel ?propertyType }
  OPTIONAL { ?transx lrppi:newBuild ?newBuild }
  OPTIONAL { ?transx lrppi:estateType/skos:prefLabel ?estateType }
  OPTIONAL { ?addr lrcommon:paon ?paon }
  OPTIONAL { ?addr lrcommon:saon ?saon }
}
ORDER BY DESC(?date)
LIMIT 50
`.trim()

  const body = new URLSearchParams({ query })
  const res = await fetch(LAND_REGISTRY_SPARQL, {
    method: 'POST',
    headers: {
      Accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) return []
  const json = (await res.json()) as { results?: { bindings?: SparqlRow[] } }
  return Array.isArray(json?.results?.bindings) ? json.results.bindings : []
}

function rowToSnapshot(
  row: SparqlRow,
  compact: string,
  addressMatched?: boolean
): LandRegistrySnapshot {
  const lastSalePrice = bindingNumber(row, 'amount')
  const lastSaleDate = bindingString(row, 'date')?.slice(0, 10)
  const propertyType = mapPropertyType(bindingString(row, 'propertyType'))
  const newBuildRaw = bindingString(row, 'newBuild')
  const newBuild =
    newBuildRaw != null
      ? ['true', '1', 'y', 'yes'].includes(newBuildRaw.toLowerCase())
      : undefined
  const tenure = mapTenure(bindingString(row, 'estateType'))

  return {
    found: true,
    postcode: compact,
    lastSalePrice,
    lastSaleDate,
    propertyType,
    newBuild,
    tenure,
    propertyValueBand: derivePropertyValueBand(lastSalePrice),
    addressMatched,
  }
}

export type FetchLandRegistryOptions = {
  houseNumber?: string | null
}

/**
 * Latest Price Paid transaction at postcode — optionally filtered by house number (PAON/SAON).
 */
export async function fetchLandRegistryByPostcode(
  postcode: string,
  options?: FetchLandRegistryOptions
): Promise<LandRegistrySnapshot> {
  const compact = postcode.replace(/\s+/g, '').trim().toUpperCase()
  const empty: LandRegistrySnapshot = {
    found: false,
    postcode: compact,
    addressMatched: options?.houseNumber?.trim() ? false : undefined,
  }
  if (compact.length < 5) return empty

  const houseToken = (options?.houseNumber ?? '').replace(/\s+/g, ' ').trim()
  const postcodeSpaced = formatUkPostcode(compact)

  try {
    const rows = await runLandRegistrySparql(postcodeSpaced)
    if (!rows.length) return empty

    const filtered = houseToken
      ? rows.filter((row) =>
          houseNumberMatchesRow(bindingString(row, 'paon'), bindingString(row, 'saon'), houseToken)
        )
      : rows

    const pick = filtered[0] ?? rows[0]
    if (!pick) return empty

    return rowToSnapshot(pick, compact, houseToken ? filtered.length > 0 : undefined)
  } catch {
    return empty
  }
}
