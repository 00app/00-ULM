'use client'

import { motion } from 'framer-motion'
import { FADE_VARIANTS } from '@/lib/animations'
import {
  PRICE_CAP_SAVING_APRIL_1,
  PRICE_CAP_MARCH_2026,
  PRICE_CAP_APRIL_2026,
  PRICE_CAP_SOURCE_URL,
} from '@/lib/brains/constants'
import { formatZoneCardMoney } from '@/lib/format'

/** Home journey only: footnote at bottom of expanded Solo Focus (shared template). */
export function SoloFocusPriceCapFooter() {
  return (
    <motion.footer
      className="solo-focus-price-cap-footer"
      variants={FADE_VARIANTS}
      initial={false}
      animate="visible"
    >
      <p className="solo-focus-price-cap-footnote solo-focus-price-cap-lead m-0 text-left">
        From 1 April: about £{PRICE_CAP_SAVING_APRIL_1}/yr less on typical use.
        <br />
        The household price cap is dropping.
        <br />
        {`Dual-fuel cap: ${formatZoneCardMoney(PRICE_CAP_MARCH_2026)}/yr → ${formatZoneCardMoney(PRICE_CAP_APRIL_2026)}/yr.`}
      </p>
      <p className="solo-focus-price-cap-footnote solo-focus-price-cap-source m-0 text-left">
        <a
          href={PRICE_CAP_SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="solo-focus-price-cap-source-link"
          aria-label="Ofgem — energy price cap (opens in new tab)"
        >
          Ofgem
        </a>
      </p>
    </motion.footer>
  )
}
