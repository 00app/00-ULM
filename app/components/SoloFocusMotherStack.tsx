'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'
import type { ReactNode } from 'react'

export type SoloFocusMotherStackProps = {
  zoneCategoryLabel: string
  headline: string
  prose?: ReactNode
  metrics: ReactNode
  showComputing?: boolean
  /** Shimmer / snap on headline (tips overlay). */
  headlineMotion?: HTMLMotionProps<'h1'>
  bodyKey?: string
  shellClassName?: string
}

/**
 * Canonical Solo Focus mother stack — single column on all breakpoints:
 * Label → H1 → lead (+ optional body) → SAVE/CARBON → Trinity → nav.
 */
export function SoloFocusMotherStack({
  zoneCategoryLabel,
  headline,
  prose,
  metrics,
  showComputing = false,
  headlineMotion,
  bodyKey,
  shellClassName = '',
}: SoloFocusMotherStackProps) {
  const headlineClass =
    'solo-focus-architect-headline solo-focus-content-text text-marvin zz-h3 text-left md:text-5xl lg:text-6xl'
  const headlineStyle = { color: 'var(--journey-text)', margin: 0, padding: 0 } as const

  const headlineEl = headlineMotion ? (
    <motion.h1 className={`${headlineClass} zz-shimmer-focus`} style={headlineStyle} {...headlineMotion}>
      {headline}
    </motion.h1>
  ) : (
    <h1 className={headlineClass} style={headlineStyle}>
      {headline}
    </h1>
  )

  return (
    <div className={`solo-focus-expanded-toolbar w-full min-w-0${shellClassName ? ` ${shellClassName}` : ''}`}>
      <div
        key={bodyKey}
        className="solo-focus-mother-body solo-focus-mother-stack w-full min-w-0 flex-1 flex flex-col items-stretch"
      >
        {showComputing ? (
          <p
            className="zz-label m-0 opacity-80"
            style={{ color: 'var(--journey-text)', letterSpacing: '0.04em' }}
          >
            Computing…
          </p>
        ) : null}
        <span
          className="card-top-label solo-focus-zone-category m-0 text-left w-full block"
          style={{ color: 'var(--journey-text)' }}
        >
          {zoneCategoryLabel}
        </span>
        {headlineEl}
        {prose}
        <div className="solo-focus-mother-metrics w-full min-w-0">{metrics}</div>
      </div>
    </div>
  )
}
