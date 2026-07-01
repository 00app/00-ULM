/**
 * Open Food Facts — product sustainability data (completely free, no key).
 * Returns eco-score, CO₂ total (kg per kg of product), and packaging grade.
 * @see https://world.openfoodfacts.org/api
 */

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product'
const TIMEOUT_MS = 8_000

export type FoodFactsSnapshot = {
  found: boolean
  barcode: string
  productName?: string
  ecoscoreGrade?: 'a' | 'b' | 'c' | 'd' | 'e'
  ecoscoreScore?: number
  /** kg CO₂ equivalent per kg of product (Agribalyse LCA data) */
  co2KgPerKg?: number
  co2Agriculture?: number
  co2Packaging?: number
  co2Transport?: number
  packagingMaterials?: string[]
  nutriscore?: string
}

type OffApiRow = {
  product?: {
    product_name?: string
    ecoscore_grade?: string
    ecoscore_score?: number
    ecoscore_data?: {
      agribalyse?: {
        co2_total?: number
        co2_agriculture?: number
        co2_packaging?: number
        co2_transportation?: number
      }
    }
    packagings?: { material?: { en?: string } }[]
    nutriscore_grade?: string
  }
  status?: number
}

export async function fetchFoodFactsByBarcode(barcode: string): Promise<FoodFactsSnapshot> {
  const empty: FoodFactsSnapshot = { found: false, barcode }
  if (!barcode?.trim()) return empty

  try {
    const res = await fetch(
      `${OFF_BASE}/${encodeURIComponent(barcode.trim())}.json?fields=product_name,ecoscore_grade,ecoscore_score,ecoscore_data,packagings,nutriscore_grade`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    )
    if (!res.ok) return empty
    const json = (await res.json()) as OffApiRow
    if (json.status !== 1 || !json.product) return empty

    const p = json.product
    const agri = p.ecoscore_data?.agribalyse

    const grade = p.ecoscore_grade?.toLowerCase()
    const validGrade = ['a', 'b', 'c', 'd', 'e'].includes(grade ?? '') ? (grade as FoodFactsSnapshot['ecoscoreGrade']) : undefined

    const materials = (p.packagings ?? [])
      .map((pk) => pk.material?.en)
      .filter((m): m is string => !!m)

    return {
      found: true,
      barcode,
      productName: p.product_name?.trim() || undefined,
      ecoscoreGrade: validGrade,
      ecoscoreScore: typeof p.ecoscore_score === 'number' ? p.ecoscore_score : undefined,
      co2KgPerKg: typeof agri?.co2_total === 'number' ? Math.round(agri.co2_total * 1000) / 1000 : undefined,
      co2Agriculture: typeof agri?.co2_agriculture === 'number' ? agri.co2_agriculture : undefined,
      co2Packaging: typeof agri?.co2_packaging === 'number' ? agri.co2_packaging : undefined,
      co2Transport: typeof agri?.co2_transportation === 'number' ? agri.co2_transportation : undefined,
      packagingMaterials: materials.length ? materials : undefined,
      nutriscore: p.nutriscore_grade?.toUpperCase() || undefined,
    }
  } catch {
    return empty
  }
}

type OffSearchRow = {
  products?: Array<{
    id?: string
    product_name?: string
    ecoscore_grade?: string
    ecoscore_score?: number
    ecoscore_data?: { agribalyse?: { co2_total?: number } }
    nutriscore_grade?: string
  }>
  count?: number
}

/** Search by product name — returns top matches with eco-score. */
export async function searchFoodFacts(query: string, limit = 5): Promise<FoodFactsSnapshot[]> {
  if (!query?.trim()) return []
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query.trim())}&search_simple=1&action=process&json=1&page_size=${limit}&fields=id,product_name,ecoscore_grade,ecoscore_score,ecoscore_data,nutriscore_grade&sort_by=ecoscore_score`
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) return []
    const json = (await res.json()) as OffSearchRow
    return (json.products ?? []).map((p) => {
      const grade = p.ecoscore_grade?.toLowerCase()
      const validGrade = ['a', 'b', 'c', 'd', 'e'].includes(grade ?? '') ? (grade as FoodFactsSnapshot['ecoscoreGrade']) : undefined
      const co2 = p.ecoscore_data?.agribalyse?.co2_total
      return {
        found: true,
        barcode: p.id ?? '',
        productName: p.product_name?.trim() || undefined,
        ecoscoreGrade: validGrade,
        ecoscoreScore: typeof p.ecoscore_score === 'number' ? p.ecoscore_score : undefined,
        co2KgPerKg: typeof co2 === 'number' ? Math.round(co2 * 1000) / 1000 : undefined,
        nutriscore: p.nutriscore_grade?.toUpperCase() || undefined,
      }
    })
  } catch {
    return []
  }
}

/** Map eco-score grade to a human label for zone copy. */
export function ecoscoreLabel(grade?: string): string {
  const map: Record<string, string> = {
    a: 'excellent',
    b: 'good',
    c: 'moderate',
    d: 'poor',
    e: 'very poor',
  }
  return map[grade?.toLowerCase() ?? ''] ?? 'unknown'
}
