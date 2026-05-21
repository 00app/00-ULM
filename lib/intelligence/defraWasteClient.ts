/**
 * Defra / WRAP waste guidance — static UK index (zero-token). Extend with council lookup later.
 */

export type DefraWasteHint = {
  council?: string
  recyclingNote: string
}

export function resolveDefraWasteHint(council?: string | null): DefraWasteHint {
  const c = council?.trim()
  return {
    council: c,
    recyclingNote:
      'check your council bin calendar and food waste caddies — most uk households still landfill a third of avoidable waste.',
  }
}
