'use client'

import type { ReactNode } from 'react'
import type { JourneyId } from '@/lib/journeys'
import { isValidJourneyId } from '@/lib/journeys'
import { MONO_ICON_VIEWBOX, monoStrokeWidth } from '@/app/components/ui/MonoStrokeIcons'

/** Bento / Rock / tip tile category glyph — 3× card-top-label (~14px) ≈ legacy open-arrow slot. */
export const ZONE_CARD_CATEGORY_ICON_PX = 42
/** Computing row spark — smaller than corner category slot. */
export const ZONE_CARD_COMPUTING_ICON_PX = 20

/** Mono stroke journey glyphs — 24×24 viewBox (same family as nav + Zai spark). */
export type ZoneCategoryIconKind = JourneyId | 'profile'

type Props = {
  kind: ZoneCategoryIconKind | string
  size?: number
  className?: string
}

export function resolveZoneCategoryIconKind(raw?: string | null): ZoneCategoryIconKind {
  if (raw === 'profile') return 'profile'
  if (raw && isValidJourneyId(raw)) return raw
  return 'carbon'
}

function CategorySvg({
  size,
  className,
  children,
}: {
  size: number
  className?: string
  children: ReactNode
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={MONO_ICON_VIEWBOX}
      fill="none"
      stroke="currentColor"
      strokeWidth={monoStrokeWidth(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  )
}

function pathsFor(kind: ZoneCategoryIconKind): ReactNode {
  switch (kind) {
    case 'profile':
      return (
        <>
          <circle cx="12" cy="8" r="3.25" />
          <path d="M6 19c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        </>
      )
    case 'home':
      return <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
    case 'utilities':
      return (
        <>
          <path d="M8 4v6h8V4M7 10h10v10H7z" />
          <path d="M10 14h4M12 12v4" />
        </>
      )
    case 'grants':
      return (
        <>
          <path d="M9 5h6v3H9z" />
          <path d="M7 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" />
          <path d="M9 12h6M9 16h4" />
        </>
      )
    case 'solar':
      return (
        <>
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" />
        </>
      )
    case 'travel':
      return (
        <>
          <path d="M5 16h11l2-5H8l-1-3H4" />
          <circle cx="8" cy="18" r="1.5" />
          <circle cx="16" cy="18" r="1.5" />
        </>
      )
    case 'holidays':
      return (
        <>
          <path d="M9 8h6v11a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V8z" />
          <path d="M10 8V6a2 2 0 0 1 4 0v2" />
        </>
      )
    case 'food':
      return (
        <>
          <path d="M8 4v8a2 2 0 0 0 4 0V4" />
          <path d="M10 4v16" />
          <path d="M16 4c1.5 2 1.5 5 0 7v9" />
        </>
      )
    case 'shopping':
      return (
        <>
          <path d="M7 9h10l-1 10H8L7 9z" />
          <path d="M9 9V7a3 3 0 0 1 6 0v2" />
        </>
      )
    case 'money':
      return (
        <>
          <rect x="5" y="6" width="14" height="12" rx="2" />
          <path d="M8 12h8M12 9.5v5" />
        </>
      )
    case 'tech':
      return (
        <>
          <rect x="8" y="3" width="8" height="18" rx="1.5" />
          <path d="M11 18h2" />
        </>
      )
    case 'water':
      return <path d="M12 3c-3.5 4-6 7.2-6 10.5a6 6 0 0 0 12 0C18 10.2 15.5 7 12 3z" />
    case 'waste':
      return (
        <>
          <path d="M5 8h14M9 8V6h6v2" />
          <path d="M7 8l1 11h8l1-11" />
        </>
      )
    case 'carbon':
    default:
      return (
        <>
          <path d="M6 14c1.5-3 4-4.5 6-4.5s4.5 1.5 6 4.5" />
          <path d="M4 17h16" />
          <path d="M8 11V8M12 10V7M16 11V9" />
        </>
      )
  }
}

export function ZoneCategoryIcon({ kind, size = 24, className }: Props) {
  const resolved = resolveZoneCategoryIconKind(kind)
  return (
    <CategorySvg size={size} className={className}>
      {pathsFor(resolved)}
    </CategorySvg>
  )
}

/** Same slot as legacy `card-top-arrow` — category glyph for bento tiles. */
export function CardTopCategoryIcon({
  kind,
  size = ZONE_CARD_CATEGORY_ICON_PX,
  className,
}: {
  kind: ZoneCategoryIconKind | string
  size?: number
  className?: string
}) {
  return (
    <span
      className={`zone-bento-card-icon card-top-arrow card-top-arrow--hint flex items-center justify-center flex-shrink-0${className ? ` ${className}` : ''}`}
      style={{
        width: size,
        height: size,
        color: 'currentColor',
        background: 'transparent',
      }}
      aria-hidden
    >
      <ZoneCategoryIcon kind={kind} size={size} />
    </span>
  )
}
