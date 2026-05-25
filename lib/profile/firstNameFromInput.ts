/** Browser autofill often supplies full name — profile stores first name only. */
export function firstNameFromAutofill(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return (trimmed.split(/\s+/)[0] ?? trimmed).trim()
}
