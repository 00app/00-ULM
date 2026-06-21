/**
 * Filter Open Data Communities EPC rows by optional house number / name.
 */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function normalizeHouseNumberToken(houseNumber: string | null | undefined): string {
  return (houseNumber ?? '').replace(/\s+/g, ' ').trim().toUpperCase()
}

export function epcRowAddress(row: Record<string, unknown>): string {
  return String(row.address ?? row['address1'] ?? '').trim()
}

/**
 * When `houseNumber` is empty, returns all rows unchanged.
 * When set, keeps rows whose register address matches the token at the start or after a comma.
 */
export function filterEpcRowsByHouseNumber(
  rows: Record<string, unknown>[],
  houseNumber: string | null | undefined
): Record<string, unknown>[] {
  const token = normalizeHouseNumberToken(houseNumber)
  if (!token || rows.length === 0) return rows

  const embedded = new RegExp(`(^|[,\\s])${escapeRegExp(token)}(?=[\\s,]|$|[A-Z])`, 'i')

  return rows.filter((row) => {
    const addr = epcRowAddress(row).toUpperCase()
    if (!addr) return false
    if (addr.startsWith(`${token} `) || addr.startsWith(`${token},`)) return true
    return embedded.test(addr)
  })
}
