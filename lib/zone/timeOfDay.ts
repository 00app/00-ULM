export type TimeOfDay = 'morning' | 'afternoon' | 'evening'

/** Client-local clock — ephemeral; never persist. */
export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

/** Zone hero greeting fragment — lowercase with full stop (zoneVoice). */
export function formatTimeOfDayGreeting(date: Date = new Date()): string {
  return `${getTimeOfDay(date)}.`
}
