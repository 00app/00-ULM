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

/** Today's Tips heading — separate boundaries from the hero greeting: morning 08:00, afternoon 14:00, evening 18:00. */
export function getTipsTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours()
  if (hour < 14) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}
