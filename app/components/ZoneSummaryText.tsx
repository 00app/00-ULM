import type { ReactNode } from 'react'

/** Currency sign (optional) + digits with , or . inside: "£2.9", "10.3", "1,200". */
const NUMBER_RE = /([£$€]?\d[\d,.]*)/g

/**
 * Splits a string into number runs and everything else. Numbers get the numerals face at its own
 * single weight (no outline stroke, no synthetic bold, which is what made them look heavier than
 * the letters); letters keep the heading treatment. Keeps every line of the head at one weight.
 */
export function ZoneSummaryText({ children }: { children: string }): ReactNode {
  const parts = children.split(NUMBER_RE)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="zs-num">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  )
}
