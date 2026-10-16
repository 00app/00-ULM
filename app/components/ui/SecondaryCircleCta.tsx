'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Secondary action as a 100px circle — the same circle-cta language as the intro SKIP and the
 * Settings CTAs, so secondary actions (Log in, Back, Skip for now…) match the primary circles
 * beside them instead of falling back to underlined text links.
 * Pass `href` for navigation, `onClick` for an action. Label in caps; use <br /> to break.
 */
export function SecondaryCircleCta({
  children,
  ariaLabel,
  onClick,
  href,
  className = '',
}: {
  children: ReactNode
  ariaLabel: string
  onClick?: () => void
  href?: string
  className?: string
}) {
  const cls = `settings-circle-cta settings-circle-cta--secondary ${className}`.trim()
  const label = <span className="settings-circle-cta__label zz-h4">{children}</span>
  if (href) {
    return (
      <Link href={href} className={cls} aria-label={ariaLabel} onClick={onClick}>
        {label}
      </Link>
    )
  }
  return (
    <button type="button" className={cls} aria-label={ariaLabel} onClick={onClick}>
      {label}
    </button>
  )
}
