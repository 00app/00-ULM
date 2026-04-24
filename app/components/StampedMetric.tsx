'use client'

import { getCarbonStampParts, getMoneyStampParts } from '@/lib/format'

/** SAVE row — stamped unit composition: £ prefix, then figures, then scale suffix. */
export function StampedMoneyGbp({ gbp }: { gbp: number }) {
  const p = getMoneyStampParts(gbp)
  return (
    <>
      <span className="data-symbol-unit" aria-hidden>
        £
      </span>
      <span className="data-stamp-figures tabular-nums">{p.digits}</span>
      {p.scaleSuffix ? (
        <span className="data-symbol-unit" aria-hidden>
          {p.scaleSuffix}
        </span>
      ) : null}
    </>
  )
}

/** CARBON row: digits + KG|T + CO₂ (each unit fragment stamped). */
export function StampedCarbonKg({ kg }: { kg: number }) {
  const p = getCarbonStampParts(kg)
  return (
    <>
      <span className="data-stamp-figures tabular-nums">{p.digits}</span>
      <span className="data-carbon-units" aria-hidden>
        <span className="data-symbol-unit">{p.massUnit}</span>
        <span className="data-symbol-unit data-co2-mark">
          CO<span className="data-co2-sub">2</span>
        </span>
      </span>
    </>
  )
}
