/**
 * Energy supplier: the six largest UK domestic suppliers plus a free-text "other".
 *
 * One module owns the vocabulary so onboarding, the API, storage, the baseline calculators and the
 * action ranker all agree on what a supplier value is. Anything not in this file is not a supplier
 * value, which is what keeps stray free text from ever reaching a calculation.
 *
 * Storage shape (localStorage keys, `user_genome` keys and session profile keys all mirror it):
 *   energy_supplier         BRITISH_GAS | OCTOPUS | EDF | EON_NEXT | OVO | SCOTTISH_POWER | OTHER
 *   energy_supplier_other   the typed name, only when energy_supplier is OTHER
 *
 * The supplier is optional. It is never part of `isProfileOnboardingCompleteFields`: plenty of
 * people do not know who supplies them (landlord-paid, HMO, prepayment) and an account that has
 * been complete for months must not be bounced back into onboarding by a new optional question.
 * A local-only SKIP marker records "asked, declined" so the step is not asked twice; it is never
 * sent to the server and every reader here treats it as unknown.
 */

export const ENERGY_SUPPLIER_STORAGE_KEY = 'profile_energy_supplier'
export const ENERGY_SUPPLIER_OTHER_STORAGE_KEY = 'profile_energy_supplier_other'

/** Local-only "asked and skipped" marker. Never persisted server-side, never a supplier. */
export const ENERGY_SUPPLIER_SKIP = 'SKIP'

export const ENERGY_SUPPLIER_OTHER = 'OTHER'
export const ENERGY_SUPPLIER_OTHER_MAX_LENGTH = 60

export type KnownEnergySupplier =
  | 'BRITISH_GAS'
  | 'OCTOPUS'
  | 'EDF'
  | 'EON_NEXT'
  | 'OVO'
  | 'SCOTTISH_POWER'

export type EnergySupplierValue = KnownEnergySupplier | typeof ENERGY_SUPPLIER_OTHER

type SupplierDef = {
  value: KnownEnergySupplier
  /** Plain-English name for copy. */
  name: string
  /** Button label; `\n` breaks the line inside the circle. */
  buttonLabel: string
  /** Names people actually type, matched after `normaliseSupplierText`. */
  aliases: string[]
  /** Supplier home page — the stable root only, never a deep link that can rot. */
  url: string
}

/**
 * Order is the button order: by domestic customer share (Ofgem retail market indicators). Octopus
 * sits second by customer count after absorbing Bulb; British Gas is still the largest.
 */
export const ENERGY_SUPPLIERS: readonly SupplierDef[] = [
  {
    value: 'BRITISH_GAS',
    name: 'British Gas',
    buttonLabel: 'BRITISH\nGAS',
    aliases: ['british gas', 'britishgas', 'bg', 'centrica', 'scottish gas'],
    url: 'https://www.britishgas.co.uk/',
  },
  {
    value: 'OCTOPUS',
    name: 'Octopus Energy',
    buttonLabel: 'OCTOPUS',
    aliases: ['octopus', 'octopus energy', 'octopus electricity', 'octopus gas'],
    url: 'https://octopus.energy/',
  },
  {
    value: 'EON_NEXT',
    name: 'E.ON Next',
    buttonLabel: 'E.ON\nNEXT',
    aliases: ['eon next', 'e on next', 'eon', 'e on', 'eon energy', 'npower', 'e on uk'],
    url: 'https://www.eonnext.com/',
  },
  {
    value: 'EDF',
    name: 'EDF',
    buttonLabel: 'EDF',
    aliases: ['edf', 'edf energy', 'edf uk', 'electricite de france'],
    url: 'https://www.edfenergy.com/',
  },
  {
    value: 'SCOTTISH_POWER',
    name: 'Scottish Power',
    buttonLabel: 'SCOTTISH\nPOWER',
    aliases: ['scottish power', 'scottishpower', 'sp energy', 'spower'],
    url: 'https://www.scottishpower.co.uk/',
  },
  {
    value: 'OVO',
    name: 'OVO Energy',
    buttonLabel: 'OVO',
    aliases: ['ovo', 'ovo energy', 'ovo uk'],
    url: 'https://www.ovoenergy.com/',
  },
]

const KNOWN_VALUES = new Set<string>(ENERGY_SUPPLIERS.map((s) => s.value))

/** Words that carry no identity ("Octopus Energy Ltd" === "Octopus"). */
const NOISE_WORDS = new Set(['ltd', 'limited', 'plc', 'uk', 'the', 'energy', 'energies', 'supply', 'supplies'])

/** Lowercase, punctuation to spaces, noise words dropped: "E.ON  Next Ltd" → "e on next". */
export function normaliseSupplierText(raw: string): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !NOISE_WORDS.has(w))
    .join(' ')
}

const ALIAS_INDEX: ReadonlyMap<string, KnownEnergySupplier> = (() => {
  const m = new Map<string, KnownEnergySupplier>()
  for (const s of ENERGY_SUPPLIERS) {
    for (const alias of [s.name, s.value.replace(/_/g, ' '), ...s.aliases]) {
      const key = normaliseSupplierText(alias)
      if (key) m.set(key, s.value)
    }
  }
  return m
})()

/** Strip anything that should never be stored or echoed back as a name. */
export function sanitiseSupplierOther(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[<>{}\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, ENERGY_SUPPLIER_OTHER_MAX_LENGTH)
}

export function isKnownEnergySupplier(v: unknown): v is KnownEnergySupplier {
  return typeof v === 'string' && KNOWN_VALUES.has(v)
}

/**
 * Canonical supplier value from anything stored or received: a slug, a slug in another case, or
 * the SKIP marker / garbage (→ '' meaning "unknown"). Used by every reader so a bad value can only
 * ever degrade to "we don't know", never to a wrong supplier.
 */
export function normaliseEnergySupplier(raw: unknown): EnergySupplierValue | '' {
  const v = String(raw ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (isKnownEnergySupplier(v)) return v
  if (v === ENERGY_SUPPLIER_OTHER) return ENERGY_SUPPLIER_OTHER
  return ''
}

/**
 * What the "other" input resolves to. Typing "octopus energy" into the other box must still be
 * Octopus — otherwise the person who reaches for the text field first silently loses every
 * supplier-aware calculation. Anything unrecognised stays OTHER with the sanitised name.
 */
export function resolveTypedSupplier(raw: string): { supplier: EnergySupplierValue | ''; other: string } {
  const clean = sanitiseSupplierOther(raw)
  if (!clean) return { supplier: '', other: '' }
  const hit = ALIAS_INDEX.get(normaliseSupplierText(clean))
  if (hit) return { supplier: hit, other: '' }
  return { supplier: ENERGY_SUPPLIER_OTHER, other: clean }
}

/** Display name for copy: the known supplier's name, the typed name for OTHER, else ''. */
export function energySupplierName(supplier: unknown, other?: unknown): string {
  const s = normaliseEnergySupplier(supplier)
  if (!s) return ''
  if (s === ENERGY_SUPPLIER_OTHER) return sanitiseSupplierOther(other)
  return ENERGY_SUPPLIERS.find((d) => d.value === s)?.name ?? ''
}

export function energySupplierUrl(supplier: unknown): string | null {
  const s = normaliseEnergySupplier(supplier)
  if (!s || s === ENERGY_SUPPLIER_OTHER) return null
  return ENERGY_SUPPLIERS.find((d) => d.value === s)?.url ?? null
}

/** Onboarding option list for the profile step (same shape as the other option questions). */
export const ENERGY_SUPPLIER_OPTIONS = ENERGY_SUPPLIERS.map((s) => ({
  label: s.buttonLabel,
  value: s.value,
  ariaLabel: s.name,
}))

/**
 * The value written into `journey_*_answers.energy_provider`. Zone card logic and the home
 * calculator compare it against 'OCTOPUS', so a known supplier is its own slug and OTHER is
 * 'OTHER' (known, and known not to be Octopus).
 *
 * Deliberately only `energy_provider`. `calculateHome` also reads `electricity_provider` and
 * `gas_provider` to add a modelled switching saving (15% off electricity kWh, 10% off gas) that
 * has no supplier-specific evidence behind it. Feeding it would raise the headline £ figure for
 * anyone who merely names their supplier, so those two fields are left for a source that can
 * actually back them.
 */
export function providerAnswerValue(supplier: unknown): string {
  return normaliseEnergySupplier(supplier)
}

/** Seed `energy_provider` into home + utilities journey answers (client only). */
export function persistEnergySupplierFromProfile(): void {
  if (typeof window === 'undefined') return
  try {
    const provider = providerAnswerValue(localStorage.getItem(ENERGY_SUPPLIER_STORAGE_KEY))
    for (const journeyKey of ['journey_home_answers', 'journey_utilities_answers']) {
      let base: Record<string, string> = {}
      try {
        const prev = localStorage.getItem(journeyKey)
        base = prev ? (JSON.parse(prev) as Record<string, string>) : {}
      } catch {
        base = {}
      }
      // Replace, don't accumulate: changing or clearing the supplier must not leave the old
      // provider behind to keep steering the switching logic.
      if (provider) base.energy_provider = provider
      else if ('energy_provider' in base) delete base.energy_provider
      else continue
      localStorage.setItem(journeyKey, JSON.stringify(base))
    }
  } catch {
    /* storage unavailable — the profile value itself is still authoritative */
  }
}
