'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface FloatingNavProps {
  active: 'likes' | 'zone' | 'summary' | 'chat'
  onNavigate: (key: 'likes' | 'zone' | 'summary' | 'chat') => void
  /** When true, Zai (chat) circle pulses with blue liquid wobble — "new scraped tip" */
  hasNewTipForZai?: boolean
}

const NAV_SIZE = 80
const SQUISH_BOUNCE = { type: 'spring' as const, stiffness: 500, damping: 30 }
const HOVER_LEAN = 1.08
const TAP_SQUISH = 0.92

/**
 * Kinetic Anchor — living dock
 * - 80px perfect circles; squish on tap, bloom into full-screen (handled by router)
 * - Active: BLUE fill. If Zai has new tip, pulse with organic liquid wobble.
 * - Hover: slight "lean" toward touch/cursor (scale + subtle pull)
 */
export default function FloatingNav({ active, onNavigate, hasNewTipForZai = false }: FloatingNavProps) {
  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(5)
  }

  const navButton = (key: 'likes' | 'zone' | 'summary' | 'chat', isActive: boolean, pulse = false, children: React.ReactNode) => (
    <motion.button
      type="button"
      className="nav-button kinetic-nav-circle"
      aria-label={key === 'chat' ? 'Zai' : key === 'summary' ? 'Settings' : key === 'zone' ? 'Zone' : 'Likes'}
      onClick={() => {
        triggerHaptic()
        onNavigate(key)
      }}
      style={{
        width: NAV_SIZE,
        height: NAV_SIZE,
        borderRadius: NAV_SIZE / 2,
        border: 'none',
        background: isActive ? 'var(--color-blue)' : 'var(--color-ice)',
        color: isActive ? 'var(--color-ice)' : 'var(--color-blue)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
      }}
      whileHover={{ scale: HOVER_LEAN }}
      whileTap={{ scale: TAP_SQUISH }}
      transition={SQUISH_BOUNCE}
    >
      {pulse && (
        <motion.span
          className="kinetic-nav-pulse"
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px solid var(--color-blue)',
            pointerEvents: 'none',
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.6, 0.2, 0.6],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
      {children}
    </motion.button>
  )

  return (
    <div className="floating-nav safe-bottom">
      {navButton(
        'likes',
        active === 'likes',
        false,
        <svg width="24" height="24" viewBox="0 0 35 32" fill="none">
          <path
            d="M9.99026 0.25C4.15156 0.25 0.25 5.11997 0.25 10.5401C0.25 15.6253 3.09299 20.0208 6.56909 23.4893C10.0452 26.9579 14.1934 29.5292 17.0399 31.0213C17.2616 31.1356 17.5242 31.1356 17.7458 31.0213C20.5923 29.5292 24.7405 26.9579 28.2166 23.4893C31.6927 20.0208 34.5357 15.6253 34.5357 10.5401C34.5357 5.11997 30.6342 0.25 24.7955 0.25C21.3536 0.25 19.067 2.03256 17.3929 4.44281C15.7187 2.03256 13.4321 0.25 9.99026 0.25ZM9.99026 1.83309C13.3281 1.83309 15.1569 3.52462 16.7231 6.18658C16.9432 6.56217 17.4217 6.68565 17.7914 6.46203C17.9029 6.39475 17.996 6.30016 18.0626 6.18658C19.6288 3.52462 21.4581 1.83309 24.7955 1.83309C29.7934 1.83309 32.9773 5.87273 32.9773 10.5401C32.9773 15.0218 30.43 19.0496 27.121 22.3515C23.9325 25.5331 20.1225 27.9528 17.3929 29.4136C14.6632 27.9532 10.8532 25.5331 7.66467 22.3515C4.35571 19.0496 1.80844 15.0218 1.80844 10.5401C1.80844 5.87273 4.99234 1.83309 9.99026 1.83309Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
        </svg>
      )}
      {navButton(
        'zone',
        active === 'zone',
        false,
        <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
          {active === 'zone' ? (
            <circle cx="10" cy="10" r="8" fill="currentColor" />
          ) : (
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
          )}
        </svg>
      )}
      {navButton(
        'summary',
        active === 'summary',
        false,
        <svg width="24" height="18" viewBox="0 0 40 31" fill="none">
          <path d="M13.3408 3.20744C18.7579 0.150982 23.8346 -0.829299 30.0735 0.736453L30.0719 0.738127C34.0187 1.71944 37.0568 3.87738 38.809 6.97752H38.8074C39.1801 7.61687 39.0709 8.36911 38.6969 8.8927C38.3028 9.44441 37.6324 9.68627 36.9909 9.56402H36.8336L36.7482 9.54561C33.6824 8.91502 31.7392 9.52071 30.2426 10.7108C29.0628 11.6491 28.1176 12.9777 27.1489 14.5495L26.1628 16.1968C24.5466 18.9483 22.7697 22.0012 19.7711 24.0015L19.155 24.3866C16.0532 26.2071 12.2509 26.5895 7.67565 25.6488H7.67231C6.96035 25.4998 6.23594 25.3234 5.47923 25.1131C4.67702 26.5274 3.97617 27.9 3.40668 29.2348L3.40501 29.2331C3.06875 30.0489 2.21585 30.4343 1.43291 30.2777L1.38101 30.2677L1.33079 30.251C1.29967 30.2406 1.26815 30.2295 1.23704 30.2192C1.20591 30.2088 1.1744 30.1994 1.14329 30.189L1.10813 30.1756L1.07298 30.1606C0.172949 29.7692 -0.24769 28.7331 0.150543 27.8336C0.886335 26.1168 1.81655 24.3311 2.87934 22.5484C2.75377 14.7657 6.70538 7.39354 13.304 3.2292L13.3224 3.21748L13.3408 3.20744ZM29.6567 2.39884C23.9045 0.955191 19.2804 1.8287 14.203 4.68902C8.05787 8.5751 4.39619 15.4852 4.5953 22.7526L4.60199 23.0038L4.47309 23.218C3.38969 25.0169 2.45486 26.8089 1.72588 28.5099L1.71751 28.5266C1.71478 28.5327 1.71421 28.5372 1.71416 28.54C1.71415 28.5435 1.71542 28.5481 1.71751 28.5534C1.71963 28.5587 1.72243 28.5647 1.72755 28.5702C1.73114 28.5739 1.73791 28.5772 1.74597 28.5819C1.75701 28.5856 1.76841 28.5899 1.77945 28.5936H1.7828C1.79422 28.5937 1.80431 28.5955 1.81126 28.5919C1.81524 28.5898 1.8172 28.5877 1.81795 28.5869C1.81857 28.5862 1.82109 28.5848 1.82298 28.5802L1.82967 28.5618L2.37208 27.3581C2.94335 26.1478 3.60052 24.919 4.32577 23.6734L4.66561 23.0908L5.31182 23.2833C6.2623 23.5664 7.15097 23.7879 8.01885 23.9697C12.325 24.8551 15.6622 24.4494 18.2878 22.9083L18.8235 22.5735C21.4325 20.8338 23.0341 18.1406 24.6863 15.328V15.3263C25.9914 13.1137 27.3049 10.8562 29.1762 9.36815C31.1074 7.8326 33.5589 7.16167 37.0027 7.84973H37.1902L37.3074 7.88322C37.3162 7.86727 37.3232 7.85298 37.3241 7.84136C37.3246 7.83434 37.3239 7.83188 37.3241 7.83299L37.3157 7.82127C35.8307 5.19396 33.2236 3.28523 29.6584 2.39884H29.6567ZM24.8152 5.91949C24.968 5.92993 25.1708 5.9587 25.3693 6.0484C25.5531 6.13153 25.7764 6.28923 25.91 6.559L25.9603 6.68288L26.0021 6.84862C26.0281 7.0078 26.0144 7.14305 26.0071 7.20353C25.9934 7.31779 25.9677 7.43423 25.9402 7.54002C25.8845 7.75411 25.7994 8.00747 25.7024 8.27161C25.5069 8.80435 25.2343 9.4564 24.9625 10.0796C24.6894 10.7059 24.4115 11.3165 24.2024 11.7688C24.098 11.9949 24.0096 12.1819 23.948 12.3129C23.9172 12.3784 23.8927 12.43 23.876 12.4652C23.8678 12.4825 23.8619 12.4962 23.8576 12.5054C23.8554 12.51 23.8537 12.5147 23.8526 12.5171L23.8509 12.5188C23.6475 12.9463 23.1349 13.129 22.7075 12.9256C22.2804 12.7221 22.099 12.2112 22.3023 11.7839L22.304 11.7805C22.305 11.7784 22.3054 11.7746 22.3074 11.7705C22.3114 11.7619 22.3178 11.7489 22.3258 11.732C22.3418 11.6981 22.3661 11.6485 22.3961 11.5847C22.4564 11.4563 22.5426 11.2716 22.6455 11.049C22.8515 10.6033 23.1241 10.0059 23.3905 9.39494C23.6554 8.78753 23.9076 8.17792 24.0853 7.69572C23.6265 7.78242 23.1411 7.92521 22.9368 7.99538C17.8808 9.89592 13.4681 13.4659 9.56405 18.9558C9.2898 19.3414 8.7545 19.4323 8.36873 19.1583C7.98299 18.884 7.89196 18.3488 8.16617 17.963C12.2286 12.2502 16.9017 8.43125 22.3425 6.38824L22.3626 6.38154L22.9887 6.19237C23.2556 6.11987 23.5641 6.04438 23.8659 5.99148C24.1604 5.93989 24.5055 5.89834 24.8152 5.91949Z" fill="currentColor" />
        </svg>
      )}
      {navButton(
        'chat',
        active === 'chat',
        hasNewTipForZai,
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )}
    </div>
  )
}
