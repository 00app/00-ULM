'use client'

import { MONO_ICON_VIEWBOX, monoStrokeWidth } from '@/app/components/ui/MonoStrokeIcons'

/** Same path as zone card open arrow (card-top-arrow), rotated 180° — points down-left for zip-shut / close. */
export default function BackArrowDownLeft({
  size = 24,
  className,
  style,
}: {
  size?: number
  className?: string
  style?: React.CSSProperties
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
      style={style}
      aria-hidden
    >
      <g transform="rotate(180 12 12)">
        <path d="M7 17L17 7M17 7H7M17 7v10" />
      </g>
    </svg>
  )
}
