'use client'

import type { CSSProperties, ReactNode } from 'react'

/** Shared 24×24 viewBox for app chrome icons (nav, bento, computing). */
export const MONO_ICON_VIEWBOX = '0 0 24 24'

/** Thin mono stroke — consistent at 18px nav and 42px bento. */
export function monoStrokeWidth(pixelSize: number): number {
  if (pixelSize >= 40) return 1.5
  if (pixelSize >= 24) return 1.75
  return 1.5
}

type IconProps = {
  size?: number
  className?: string
  style?: CSSProperties
}

function MonoStrokeSvg({
  size = 24,
  className,
  style,
  children,
}: IconProps & { children: ReactNode }) {
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
      {children}
    </svg>
  )
}

/** Four-point spark — Zai chat, computing, nav centre. */
export function ZaiSparkPaths() {
  return (
    <>
      <path d="M12 3v4.5M12 16.5V21M3 12h4.5M16.5 12H21" />
      <path d="m7.05 7.05 3.18 3.18M13.77 13.77l3.18 3.18M7.05 16.95l3.18-3.18M13.77 10.23l3.18-3.18" />
    </>
  )
}

export function ZaiSparkIcon({ size = 22, className, style }: IconProps) {
  return (
    <MonoStrokeSvg size={size} className={className} style={style}>
      <ZaiSparkPaths />
    </MonoStrokeSvg>
  )
}

/** Likes — stroke heart (no fill). */
export function HeartOutlineIcon({ size = 18, className, style }: IconProps) {
  return (
    <MonoStrokeSvg size={size} className={className} style={style}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </MonoStrokeSvg>
  )
}

/** Settings / profile — stroke user. */
export function ProfileOutlineIcon({ size = 18, className, style }: IconProps) {
  return (
    <MonoStrokeSvg size={size} className={className} style={style}>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </MonoStrokeSvg>
  )
}

/** Truth saving / actioned check. */
export function CheckOutlineIcon({ size = 18, className, style }: IconProps) {
  return (
    <MonoStrokeSvg size={size} className={className} style={style}>
      <path d="M20 6 9 17l-5-5" />
    </MonoStrokeSvg>
  )
}

/** External link / offer handoff. */
export function ArrowNEOutlineIcon({ size = 18, className, style }: IconProps) {
  return (
    <MonoStrokeSvg size={size} className={className} style={style}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </MonoStrokeSvg>
  )
}

/** Zone card open / Solo Focus close (north-east). */
export function OpenNEOutlineIcon({ size = 18, className, style }: IconProps) {
  return (
    <MonoStrokeSvg size={size} className={className} style={style}>
      <path d="M7 17 17 7M17 7H7M17 7v10" />
    </MonoStrokeSvg>
  )
}

/** Modal / overlay close — 1px rounded stroke (Likes, Zai, Settings, Solo Focus). */
export function CloseXOutlineIcon({ size = 24, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={MONO_ICON_VIEWBOX}
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      <path d="M7 7 17 17M17 7 7 17" />
    </svg>
  )
}
