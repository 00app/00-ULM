import type { Pool } from 'pg'

export type ZaiResearchSourceHint = {
  sourceUrl: string | null
  offerUrl: string | null
  savingGbp: number | null
  headline: string | null
}

function toNum(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Latest Neon `research_results` row for Zai chat — URLs + £ only (no architect_prose; Zai must not repeat card copy).
 */
export async function loadZaiResearchSourceHint(
  pool: Pool,
  args: {
    category: string
    postcode: string | null
    userId?: string | null
  }
): Promise<ZaiResearchSourceHint | null> {
  const category = String(args.category ?? '').trim().toLowerCase().slice(0, 40)
  if (!category) return null
  const pc = String(args.postcode ?? '').replace(/\s+/g, '').trim().slice(0, 12)

  try {
    let row: Record<string, unknown> | undefined
    if (args.userId && pc.length >= 4) {
      const res = await pool.query(
        `SELECT offer_url, source_url, saving_amount_gbp, agent_headline
         FROM research_results
         WHERE LOWER(TRIM(category)) = $1
           AND (user_id = $2::uuid OR REPLACE(COALESCE(postcode, ''), ' ', '') = $3)
         ORDER BY created_at DESC NULLS LAST
         LIMIT 1`,
        [category, args.userId, pc]
      )
      row = res.rows[0] as Record<string, unknown> | undefined
    } else if (args.userId) {
      const res = await pool.query(
        `SELECT offer_url, source_url, saving_amount_gbp, agent_headline
         FROM research_results
         WHERE LOWER(TRIM(category)) = $1 AND user_id = $2::uuid
         ORDER BY created_at DESC NULLS LAST
         LIMIT 1`,
        [category, args.userId]
      )
      row = res.rows[0] as Record<string, unknown> | undefined
    } else if (pc.length >= 4) {
      const res = await pool.query(
        `SELECT offer_url, source_url, saving_amount_gbp, agent_headline
         FROM research_results
         WHERE LOWER(TRIM(category)) = $1
           AND REPLACE(COALESCE(postcode, ''), ' ', '') = $2
         ORDER BY created_at DESC NULLS LAST
         LIMIT 1`,
        [category, pc]
      )
      row = res.rows[0] as Record<string, unknown> | undefined
    }
    if (!row) return null

    const offer = typeof row.offer_url === 'string' ? row.offer_url.trim() : ''
    const source = typeof row.source_url === 'string' ? row.source_url.trim() : ''
    const headline = typeof row.agent_headline === 'string' ? row.agent_headline.trim().slice(0, 160) : null

    return {
      sourceUrl: source.startsWith('http') ? source : null,
      offerUrl: offer.startsWith('http') ? offer : null,
      savingGbp: toNum(row.saving_amount_gbp),
      headline: headline || null,
    }
  } catch {
    return null
  }
}

export function formatZaiResearchSourceLine(
  hint: ZaiResearchSourceHint | null,
  clientScrapedSource?: string | null
): string {
  const client = String(clientScrapedSource ?? '').trim()
  const httpClient = client.startsWith('http') ? client : ''
  const url = hint?.offerUrl ?? hint?.sourceUrl ?? httpClient
  const parts: string[] = []
  if (url) parts.push(`stored source url: ${url}.`)
  if (hint?.savingGbp != null) parts.push(`stored saving_amount_gbp: £${Math.round(hint.savingGbp)}.`)
  if (hint?.headline) parts.push(`stored agent_headline (do not repeat as editorial): ${hint.headline}.`)
  if (!parts.length && client && !client.startsWith('http')) {
    parts.push(`source note: "${client.slice(0, 200)}".`)
  }
  return parts.length ? ` ${parts.join(' ')}` : ''
}
