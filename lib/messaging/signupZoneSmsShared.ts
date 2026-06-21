/** Client-safe SMS helpers — no Twilio / Node imports. */

export type SignupSmsItem = {
  title: string
  url?: string
  gbp?: number
}

export type SignupZoneSmsInput = {
  userName?: string
  /** Legacy slug list — used when `tips` omitted. */
  tipSlugs?: string[]
  tips?: SignupSmsItem[]
  recommendations?: Array<string | SignupSmsItem>
}

export function normalizeSmsUrl(raw: string | undefined | null): string | undefined {
  const u = raw?.trim()
  if (!u?.startsWith('https://')) return undefined
  return u
}

/** Best https offer/source URL from a journey mother tile. */
export function resolveJourneyCardUrl(item: {
  cta?: { url?: string }
  claimOfferUrl?: string
  partner_link?: string
  actions?: { actionUrl?: string; learnUrl?: string }
  source?: string
}): string | undefined {
  for (const raw of [
    item.cta?.url,
    item.claimOfferUrl,
    item.partner_link,
    item.actions?.actionUrl,
    item.actions?.learnUrl,
    item.source,
  ]) {
    const url = normalizeSmsUrl(raw)
    if (url) return url
  }
  return undefined
}
