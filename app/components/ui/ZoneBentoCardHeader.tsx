'use client'

import { formatZoneCategoryLabel } from '@/lib/soloFocusCopy'

type Props = {
  journeyId: string
  /** Override category text (still uppercased by formatter when using journeyId). */
  label?: string
  /** Pink achievement discovery — fixed-width “+” before label (no label string drift). */
  showPlus?: boolean
  textColor?: string
}

/**
 * Locked top row for Zone bento tiles — category label only (no decorative icon).
 */
export function ZoneBentoCardHeader({
  journeyId,
  label,
  showPlus = false,
  textColor,
}: Props) {
  const categoryText = label ?? formatZoneCategoryLabel(String(journeyId ?? 'home'))

  return (
    <div
      className="zone-bento-card-header w-full shrink-0"
      style={textColor ? { color: textColor } : undefined}
    >
      <div className="zone-bento-card-header__label-wrap min-w-0">
        {showPlus ? (
          <span className="zone-bento-card-header__plus zone-bento-card-header__plus--on" aria-hidden>
            +
          </span>
        ) : null}
        <span className="card-top-label zone-bento-card-header__label m-0 min-w-0">
          {categoryText}
        </span>
      </div>
    </div>
  )
}
