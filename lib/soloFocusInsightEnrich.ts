/**
 * Solo Focus v2.1 — when upstream copy is thin, append depth so the sub-info rail
 * reads as 2–3 sentences (client-side Brain shim; server may still send richer prose).
 */
function countRoughSentences(text: string): number {
  const t = text.trim()
  if (!t) return 0
  const parts = t.split(/(?<=[.!?])\s+/).filter((p) => p.trim().length > 0)
  return Math.max(parts.length, t.length > 90 ? 2 : 1)
}

export function enrichSoloFocusSubinfoProse(
  raw: string,
  ctx: { journeyLabel: string; headline: string; discoveryWin?: string | null }
): string {
  const base = raw.trim()
  const win = (ctx.discoveryWin ?? '').trim()
  const primary =
    base ||
    win ||
    `This ${ctx.headline} track is tuned to your profile so every answer tightens savings and carbon numbers for ${ctx.journeyLabel.replace(/-/g, ' ')}.`

  if (countRoughSentences(primary) >= 3 && primary.length >= 140) return primary

  const why =
    'Why it matters: small, repeatable choices here compound into lower annual spend and a cleaner footprint for your household.'
  const next =
    'Next step: use the link to verify eligibility, then continue the questions so the next tip can calibrate to your answers.'

  if (countRoughSentences(primary) >= 2) {
    return `${primary} ${next}`
  }
  return `${primary} ${why} ${next}`
}
