'use client'

import Link from 'next/link'
import { ROUTES } from '@/lib/routes'
import { ResetDataCircleButton } from '@/app/components/ResetDataCircleButton'

type FooterProps = {
  /** Zone wall — show RESET DATA disc above the privacy line. */
  showReset?: boolean
  className?: string
}

/** Site-wide footer — optional reset CTA + © line + Privacy & Data (Marvin H4). */
export function Footer({ showReset = false, className = '' }: FooterProps) {
  return (
    <footer
      className={`site-footer${showReset ? ' site-footer--with-reset' : ''} ${className}`.trim()}
      aria-label="Site footer"
    >
      {showReset ? (
        <div className="site-footer__reset-row">
          <ResetDataCircleButton />
        </div>
      ) : null}
      <h4 className="site-footer__line zz-h4 m-0">
        © 2026 Zero Zero —{' '}
        <Link href={ROUTES.PRIVACY} className="site-footer__link">
          Privacy &amp; Data
        </Link>
      </h4>
    </footer>
  )
}
