'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import type { RockHabit } from '@/lib/rock/types'
import { ROCK_HABITS, habitToTipCard } from '@/lib/rock/habitsCatalog'
import { SPRING_BLOOM, SPRING_TAP } from '@/lib/animations'
import InputField from '@/app/components/InputField'
import { useApp } from '@/app/context/AppContext'
import { parseMoneyGbpFromDisplay, parseCarbonKgFromDisplay } from '@/lib/format'
import { StampedMoneyGbp, StampedCarbonKg } from '@/app/components/StampedMetric'

/** Industrial lock: same shell as yellow Zone tiles — yellow field, purple type. */
const ROCK_CARD_BG = 'var(--color-yellow)' as const
const ROCK_CARD_TEXT = 'var(--color-purple)' as const

const INSTAGRAM_HREF =
  process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim() || 'https://www.instagram.com/percyzerozero/'

type Props = {
  habits: RockHabit[]
  likedCardIds: readonly string[]
  onOpenTip: (tipId: string) => void
}

const TIP_LABEL_H = 14
const TIP_ARROW_SZ = TIP_LABEL_H * 3

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 11-2.881 0 1.44 1.44 0 012.881 0z" />
    </svg>
  )
}

/** Always six slots — back-fill from catalog if rotation returns fewer. */
function ensureSixRockHabits(habits: RockHabit[]): RockHabit[] {
  const seen = new Set(habits.map((h) => h.slug))
  const out = [...habits]
  for (const h of ROCK_HABITS) {
    if (out.length >= 6) break
    if (!seen.has(h.slug)) {
      seen.add(h.slug)
      out.push(h)
    }
  }
  return out.slice(0, 6)
}

/**
 * The Rock — six saving-tip tiles: same bento shell as Zone (yellow / purple, `bento-card-groovy`).
 * Grid: 1 col mobile / 2 tablet / 3 desktop (matches Zone rhythm below XL).
 */
export function RockSavingTips({ habits, likedCardIds, onOpenTip }: Props) {
  const six = ensureSixRockHabits(habits)
  const router = useRouter()
  const { setUserId, refreshProfile } = useApp()
  const [email, setEmail] = useState('')
  const [signupBusy, setSignupBusy] = useState(false)
  const [signupMsg, setSignupMsg] = useState<string | null>(null)

  const submitEmail = useCallback(async () => {
    const e = email.trim().toLowerCase()
    if (!e || signupBusy) return
    setSignupBusy(true)
    setSignupMsg(null)
    try {
      const res = await fetch('/api/marketing-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e }),
      })
      if (!res.ok) {
        setSignupMsg('check your email format')
        return
      }
      try {
        localStorage.setItem('zz_marketing_email', e)
      } catch {
        /* ignore */
      }
      setSignupMsg("you're in — we'll be in touch.")
      setEmail('')
    } catch {
      setSignupMsg('something went wrong — try again')
    } finally {
      setSignupBusy(false)
    }
  }, [email, signupBusy])

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {
      /* still clear client */
    }
    try {
      localStorage.removeItem('userId')
      localStorage.removeItem('user_id')
      localStorage.removeItem('userEmail')
    } catch {
      /* ignore */
    }
    setUserId(null)
    refreshProfile()
    router.refresh()
  }, [setUserId, refreshProfile, router])

  if (six.length === 0) return null

  return (
    <section className="rock-saving-tips-section w-full text-left pb-16 pt-2 box-border" aria-label="Saving tips">
      <h3
        className="card-headline zz-h3 m-0 mb-[20px] uppercase tracking-wide text-center w-full px-[20px] lg:px-[40px] box-border"
        style={{
          color: 'var(--color-yellow)',
          fontFamily: 'var(--font-marvin)',
          fontWeight: 700,
        }}
      >
        Saving Tips
      </h3>
      <div className="groovy-zone-grid mx-auto items-stretch w-full rock-saving-tips-grid">
        {six.map((h) => {
          const tip = habitToTipCard(h)
          const liked = likedCardIds.includes(tip.id)
          const jid = h.journey_key
          const tipHeadline = h.title.split(/\s+/).slice(0, 5).join(' ')
          const gbp = parseMoneyGbpFromDisplay(String(tip.data.money ?? '0'))
          const kg = parseCarbonKgFromDisplay(String(tip.data.carbon ?? '0'))

          return (
            <motion.button
              key={tip.id}
              type="button"
              layout
              transition={SPRING_BLOOM}
              onClick={() => onOpenTip(tip.id)}
              className="bento-card-groovy rock-bento-tile groovy-cell-radius flex flex-col justify-between w-full h-full min-h-0 cursor-pointer border-0 text-left"
              style={{
                backgroundColor: ROCK_CARD_BG,
                color: ROCK_CARD_TEXT,
                ['--color-ink' as string]: ROCK_CARD_TEXT,
                borderRadius: 60,
                boxShadow: 'none',
              }}
              whileTap={{ scale: 0.96 }}
            >
              <div className="flex items-center justify-between w-full shrink-0 gap-2">
                <span className="card-top-label" style={{ color: ROCK_CARD_TEXT }}>
                  {(jid || 'TIP').replace(/-/g, ' ').toUpperCase()}
                </span>
                <span
                  className="card-top-arrow card-top-arrow--hint flex items-center justify-center flex-shrink-0"
                  style={{
                    width: TIP_ARROW_SZ,
                    height: TIP_ARROW_SZ,
                    color: 'currentColor',
                    background: 'transparent',
                  }}
                  aria-hidden
                >
                  <svg
                    width={TIP_ARROW_SZ}
                    height={TIP_ARROW_SZ}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 17L17 7M17 7H7M17 7v10" />
                  </svg>
                </span>
              </div>
              <h2 className="card-headline m-0" lang="en" style={{ color: ROCK_CARD_TEXT }}>
                {tipHeadline}
              </h2>
              <div className="card-impact-grid grid grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-0">
                <div className="data-stack data-stack--tight">
                  <span className="data-label" style={{ color: ROCK_CARD_TEXT }}>
                    SAVE
                  </span>
                  <span className="data-value text-data data-stamp-metric" style={{ color: 'var(--color-ink)' }}>
                    <StampedMoneyGbp gbp={gbp} />
                  </span>
                </div>
                <div className="data-stack data-stack--tight">
                  <span className="data-label" style={{ color: ROCK_CARD_TEXT }}>
                    CARBON
                  </span>
                  <span className="data-value text-data data-stamp-metric" style={{ color: 'var(--color-ink)' }}>
                    <StampedCarbonKg kg={kg} />
                    {liked ? (
                      <span className="data-unit" aria-hidden>
                        {' '}
                        · ♥
                      </span>
                    ) : null}
                  </span>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>

      <div className="w-full max-w-[min(1400px,100%)] mx-auto mt-8 px-[20px] lg:px-[40px] box-border">
        <div
          className="rock-email-signup-card bento-card-groovy rock-bento-tile w-full flex flex-col border-0 text-left box-border"
          style={{
            backgroundColor: ROCK_CARD_BG,
            color: ROCK_CARD_TEXT,
            borderRadius: 60,
          }}
        >
        <div className="flex items-center justify-between w-full shrink-0 gap-2">
          <span className="card-top-label" style={{ color: ROCK_CARD_TEXT }}>
            Sign up via email
          </span>
        </div>
        <p className="zz-body m-0 mt-1" style={{ color: ROCK_CARD_TEXT, opacity: 0.92 }}>
          tips, drops, and grid updates — same energy as your profile flow.
        </p>
        <div className="rock-email-row">
          <InputField
            type="email"
            value={email}
            onChange={setEmail}
            onAdvance={submitEmail}
            placeholder="email"
            className="rock-email-zz-input"
            width="100%"
          />
          <motion.button
            type="button"
            className="rock-email-go-btn"
            disabled={!email.trim() || signupBusy}
            onClick={() => void submitEmail()}
            whileTap={email.trim() && !signupBusy ? { scale: 0.94 } : undefined}
            transition={SPRING_TAP}
            aria-label="Submit email signup"
          >
            Go
          </motion.button>
        </div>
        {signupMsg ? (
          <p className="zz-body-bold m-0 mt-3" style={{ color: ROCK_CARD_TEXT }}>
            {signupMsg}
          </p>
        ) : null}

        <div className="rock-social-row">
          <motion.a
            href={INSTAGRAM_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="rock-ig-link"
            aria-label="Zero Zero on Instagram"
            whileTap={{ scale: 0.94 }}
            transition={SPRING_TAP}
          >
            <InstagramGlyph />
          </motion.a>
          <motion.button
            type="button"
            className="rock-logout-btn"
            onClick={() => void handleLogout()}
            whileTap={{ scale: 0.94 }}
            transition={SPRING_TAP}
          >
            Log out
          </motion.button>
        </div>
        </div>
      </div>
    </section>
  )
}
