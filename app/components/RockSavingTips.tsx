'use client'

import React, { useState, useCallback, useEffect } from 'react'
import type { RockHabit } from '@/lib/rock/types'
import { ROCK_HABITS, habitToTipCard } from '@/lib/rock/habitsCatalog'
import InputField from '@/app/components/InputField'
import { parseMoneyGbpFromDisplay, parseCarbonKgFromDisplay } from '@/lib/format'
import { StampedMoneyGbp, StampedCarbonKg } from '@/app/components/StampedMetric'
import { ZoneBentoCardHeader } from '@/app/components/ui/ZoneBentoCardHeader'
import {
  cleanZonePreviewHeadline,
  headlineFromTitle,
  MAX_ZONE_CARD_HEADLINE_WORDS,
} from '@/lib/soloFocusCopy'

/** Industrial lock: Tips/settings are pink base with yellow items. */
const ROCK_CARD_BG = 'var(--color-pink)' as const
const ROCK_CARD_TEXT = 'var(--color-yellow)' as const

const PROFILE_MOBILE_LS = 'zz_profile_mobile'

const INSTAGRAM_HREF =
  process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim() || 'https://www.instagram.com/percyzerozero/'

type Props = {
  habits: RockHabit[]
  likedCardIds: readonly string[]
  onOpenTip: (tipId: string) => void
}

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
  const [mobile, setMobile] = useState('')
  const [signupBusy, setSignupBusy] = useState(false)
  const [signupMsg, setSignupMsg] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROFILE_MOBILE_LS)
      if (saved) setMobile(saved)
    } catch {
      /* ignore */
    }
  }, [])

  const submitMobile = useCallback(async () => {
    const raw = mobile.trim()
    if (!raw || signupBusy) return
    setSignupBusy(true)
    setSignupMsg(null)
    try {
      const res = await fetch('/api/profile/mobile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: raw }),
      })
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        persisted?: boolean
        mobile?: string
      } | null
      if (!res.ok || !data?.ok) {
        setSignupMsg(data?.error === 'invalid mobile number' ? 'check your mobile number' : 'something went wrong — try again')
        return
      }
      const canonical = typeof data.mobile === 'string' ? data.mobile : raw
      try {
        localStorage.setItem(PROFILE_MOBILE_LS, canonical)
      } catch {
        /* ignore */
      }
      setSignupMsg(
        data.persisted
          ? "saved — we'll reach you on this number."
          : 'saved on this device. Sign in to sync to your profile.',
      )
      setMobile('')
    } catch {
      setSignupMsg('something went wrong — try again')
    } finally {
      setSignupBusy(false)
    }
  }, [mobile, signupBusy])

  if (six.length === 0) return null

  return (
    <section className="rock-saving-tips-section w-full text-left pb-16 pt-2 box-border" aria-label="Today's tips">
      <div className="groovy-zone-grid mx-auto w-full rock-saving-tips-grid">
        {six.map((h) => {
          const tip = habitToTipCard(h)
          const liked = likedCardIds.includes(tip.id)
          const jid = h.journey_key
          const tipHeadline = headlineFromTitle(
            cleanZonePreviewHeadline(h.title),
            MAX_ZONE_CARD_HEADLINE_WORDS
          )
          const gbp = parseMoneyGbpFromDisplay(String(tip.data.money ?? '0'))
          const kg = parseCarbonKgFromDisplay(String(tip.data.carbon ?? '0'))

          return (
            <button
              key={tip.id}
              type="button"
              onClick={() => onOpenTip(tip.id)}
              data-zone-surface="tip"
              className="bento-card-groovy rock-bento-tile groovy-cell-radius flex flex-col justify-between w-full h-full min-h-0 cursor-pointer border-0 text-left"
              style={{
                ['--journey-bg' as string]: ROCK_CARD_BG,
                ['--journey-text' as string]: ROCK_CARD_TEXT,
                ['--color-ink' as string]: ROCK_CARD_TEXT,
                borderRadius: 60,
                boxShadow: 'none',
              }}
            >
              <ZoneBentoCardHeader
                journeyId={jid ?? 'carbon'}
                textColor={ROCK_CARD_TEXT}
              />
              <h3 className="card-headline m-0 min-w-0" lang="en">
                {tipHeadline}
              </h3>
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
            </button>
          )
        })}
      </div>

      <div className="zone-rock-signup-wrap w-full box-border">
        <div
          className="rock-mobile-signup-card bento-card-groovy rock-bento-tile w-full flex flex-col border-0 text-left box-border"
          style={{
            backgroundColor: ROCK_CARD_BG,
            color: ROCK_CARD_TEXT,
            borderRadius: 60,
          }}
        >
          <h3
            className="zz-anchor-greeting m-0 tracking-wide"
            lang="en"
            style={{ color: ROCK_CARD_TEXT }}
          >
            Sign up with your mobile
          </h3>
          <p className="zz-body m-0 mt-1" style={{ color: ROCK_CARD_TEXT, opacity: 0.92 }}>
            for tips and new offer drops
          </p>
          <div className="rock-mobile-row">
            <InputField
              type="tel"
              value={mobile}
              onChange={setMobile}
              onAdvance={submitMobile}
              placeholder="UK mobile"
              className="rock-mobile-zz-input"
              width="100%"
            />
            <button
              type="button"
              className="rock-mobile-go-btn"
              disabled={!mobile.trim() || signupBusy}
              onClick={() => void submitMobile()}
              aria-label="Save mobile number"
            >
              Go
            </button>
          </div>
          {signupMsg ? (
            <p className="zz-body-bold m-0 mt-3" style={{ color: ROCK_CARD_TEXT }}>
              {signupMsg}
            </p>
          ) : null}

          <div className="rock-social-row">
            <a
              href={INSTAGRAM_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="rock-ig-link"
              aria-label="Zero Zero on Instagram"
            >
              <InstagramGlyph />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
