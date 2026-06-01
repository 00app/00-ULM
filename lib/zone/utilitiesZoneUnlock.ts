/**
 * UTILITIES is the 13th Zone category — always visible on the wall; richest tariff data after profile power type.
 */

export type ProfilePowerTypeFields = {
  home_power?: string | null
  homePower?: string | null
}

export function readProfilePowerType(
  profile?: ProfilePowerTypeFields | null
): string {
  const raw = profile?.home_power ?? profile?.homePower ?? ''
  return String(raw).trim().toUpperCase()
}

export function isUtilitiesZoneCardUnlocked(profile?: ProfilePowerTypeFields | null): boolean {
  return readProfilePowerType(profile).length > 0
}
