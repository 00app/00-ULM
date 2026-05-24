/**
 * UTILITIES is the 13th Zone category — born on the wall only after profile **power type**.
 * (12 journey tiles visible before; utilities unlocks when `profile_home_power` is set.)
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
