'use client'

import {
  CardTopCategoryIcon,
  ZONE_CARD_CATEGORY_ICON_PX,
  type ZoneCategoryIconKind,
} from '@/app/components/ui/ZoneCategoryIcon'
import { formatZoneCategoryLabel } from '@/lib/soloFocusCopy'

type Props = {
  journeyId: ZoneCategoryIconKind | string
  /** Override category text (still uppercased by formatter when using journeyId). */
  label?: string
  /** Pink achievement discovery — fixed-width “+” suffix (no label string drift). */
  showPlus?: boolean
  textColor?: string
  iconKind?: ZoneCategoryIconKind | string
}

/**
 * Locked top row for Zone bento tiles — label column + category icon column.
 * Same grid on journey, tip, inject, and achievement cards (no badge slot drift).
 */
export function ZoneBentoCardHeader({
  journeyId,
  label,
  showPlus = false,
  textColor,
  iconKind,
}: Props) {
  const categoryText = label ?? formatZoneCategoryLabel(String(journeyId ?? 'home'))

  return (
    <div
      className="zone-bento-card-header w-full shrink-0"
      style={textColor ? { color: textColor } : undefined}
    >
      <div className="zone-bento-card-header__label-wrap min-w-0">
        <span className="card-top-label zone-bento-card-header__label m-0 min-w-0">
          {categoryText}
        </span>
        {showPlus ? (
          <span className="zone-bento-card-header__plus zone-bento-card-header__plus--on" aria-hidden>
            +
          </span>
        ) : null}
      </div>
      <div className="zone-bento-card-header__icon-slot">
        <CardTopCategoryIcon
          kind={iconKind ?? journeyId}
          size={ZONE_CARD_CATEGORY_ICON_PX}
        />
      </div>
    </div>
  )
}
