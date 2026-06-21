export type UkSeason = 'spring' | 'summer' | 'autumn' | 'winter'

const UK_TZ = 'Europe/London'

/** Calendar month (1–12) in UK local time — ephemeral; never persist. */
export function getUkCalendarMonth(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TZ,
    month: 'numeric',
  }).formatToParts(date)
  const monthPart = parts.find((p) => p.type === 'month')?.value
  const month = monthPart ? Number.parseInt(monthPart, 10) : date.getUTCMonth() + 1
  return Number.isFinite(month) ? month : date.getUTCMonth() + 1
}

/** UK meteorological seasons — Mar–May, Jun–Aug, Sep–Nov, Dec–Feb. */
export function getUkSeason(date: Date = new Date()): UkSeason {
  const month = getUkCalendarMonth(date)
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}
