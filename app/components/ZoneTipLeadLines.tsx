'use client'

import React from 'react'

export type ZoneTipLeadLine = {
  key: string
  line: string
  headline: string
  ariaLabel: string
  onClick: () => void
}

type Props = {
  lines: readonly ZoneTipLeadLine[]
  disabled?: boolean
  className?: string
}

/** Hero + Today's Tips — shared `zone-hero-profile-lead` link rows. */
export function ZoneTipLeadLines({ lines, disabled = false, className }: Props) {
  if (lines.length === 0) return null
  return (
    <div
      className={
        className ??
        'zone-lead-tip-list flex flex-col shrink-0 gap-[clamp(10px,2.5cqw,16px)] w-full'
      }
    >
      {lines.map((line) => (
        <button
          key={line.key}
          type="button"
          className="zone-hero-win-cta"
          disabled={disabled}
          aria-label={line.ariaLabel}
          onClick={line.onClick}
        >
          <h3 className="zone-hero-profile-lead zz-h3 m-0 min-w-0" lang="en">
            {line.line}
          </h3>
        </button>
      ))}
    </div>
  )
}
