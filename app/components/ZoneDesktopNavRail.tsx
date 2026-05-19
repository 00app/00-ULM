'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/lib/routes'

const ICON_SIZE = 18

/**
 * Desktop-only vertical nav in the Zone hero gallery column (Likes · Zai · Settings).
 */
export default function ZoneDesktopNavRail() {
  const router = useRouter()

  const item = (label: string, onClick: () => void, children: ReactNode) => (
    <button
      type="button"
      className="zone-desktop-nav-item"
      aria-label={label}
      onClick={onClick}
    >
      <span className="zone-desktop-nav-item-inner">{children}</span>
    </button>
  )

  return (
    <nav className="zone-desktop-nav-rail" aria-label="Zone shortcuts">
      {item('Likes', () => router.push(ROUTES.LIKES), (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 35 32" fill="none" aria-hidden>
          <path
            d="M9.99026 0.25C4.15156 0.25 0.25 5.11997 0.25 10.5401C0.25 15.6253 3.09299 20.0208 6.56909 23.4893C10.0452 26.9579 14.1934 29.5292 17.0399 31.0213C17.2616 31.1356 17.5242 31.1356 17.7458 31.0213C20.5923 29.5292 24.7405 26.9579 28.2166 23.4893C31.6927 20.0208 34.5357 15.6253 34.5357 10.5401C34.5357 5.11997 30.6342 0.25 24.7955 0.25C21.3536 0.25 19.067 2.03256 17.3929 4.44281C15.7187 2.03256 13.4321 0.25 9.99026 0.25Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
        </svg>
      ))}
      {item('Ask Zai', () => router.push(ROUTES.ZAI), (
        <svg
          width={ICON_SIZE}
          height={ICON_SIZE}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5H7l-4 3V12A8.5 8.5 0 0 1 11.5 3.5h1A8.5 8.5 0 0 1 21 12z" />
        </svg>
      ))}
      {item('Settings', () => router.push(ROUTES.SETTINGS), (
        <svg
          width={ICON_SIZE}
          height={ICON_SIZE}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="8" r="4" />
        </svg>
      ))}
    </nav>
  )
}
