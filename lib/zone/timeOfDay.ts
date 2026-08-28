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

/**
 * Today's Tips heading. Used to carry its own later cutoffs (morning 08:00, afternoon 14:00,
 * evening 18:00) than the hero greeting above — meaning for about an hour either side of each
 * boundary, the hero and the tips heading could show different times of day on the same screen
 * at once (e.g. hero says "evening", tips still says "afternoon"). No record of that being a
 * deliberate content-relevance choice rather than drift, and a page contradicting its own clock
 * reads as broken, so this now just aliases the one clock everything else on Zone uses.
 */
export function getTipsTimeOfDay(date: Date = new Date()): TimeOfDay {
  return getTimeOfDay(date)
}
