'use client'

import { getCarbonStampParts, getMoneyStampParts } from '@/lib/format'

/** SAVE row — stamped unit composition: £ prefix, then figures, then scale suffix. */
export function StampedMoneyGbp({ gbp, live }: { gbp: number; live?: boolean }) {
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
      {live ? (
        <span
          className="data-symbol-unit"
          style={{ marginLeft: 6, padding: '0 6px', borderRadius: 9999, border: '1px solid currentColor' }}
        >
          Live
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
