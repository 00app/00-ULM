'use client'

import React, { useState, useCallback, useEffect } from 'react'
import type { JourneyId } from '@/lib/journeys'
import type { RockHabit } from '@/lib/rock/types'
import { habitToTipCard } from '@/lib/rock/habitsCatalog'
import { zoneCardDomId } from '@/lib/zone/soloFocusReturn'
import InputField from '@/app/components/InputField'
import { FixedViewportPortal } from '@/app/components/FixedViewportPortal'
import { parseMoneyGbpFromDisplay, parseCarbonKgFromDisplay } from '@/lib/format'
import { StampedMoneyGbp, StampedCarbonKg } from '@/app/components/StampedMetric'
import { ZoneBentoCardHeader } from '@/app/components/ui/ZoneBentoCardHeader'
import { HeartOutlineIcon } from '@/app/components/ui/MonoStrokeIcons'
import { CloseXOutlineIcon } from '@/app/components/ui/MonoStrokeIcons'
import { clampRockTipHeadline } from '@/lib/soloFocusCopy'
import type { SignupSmsItem } from '@/lib/messaging/signupZoneSmsShared'
import Link from 'next/link'
import { ROUTES } from '@/lib/routes'
import { HumanCheckTurnstile } from '@/app/components/HumanCheckTurnstile'
import { turnstileSiteKey } from '@/lib/security/botGuard'

/** Industrial lock: Tips/settings are pink base with yellow items. */
const ROCK_CARD_BG = 'var(--color-pink)' as const
const ROCK_CARD_TEXT = 'var(--color-yellow)' as const

const PROFILE_MOBILE_LS = 'zz_profile_mobile'
const PROFILE_SMS_OPT_IN_LS = 'zz_profile_sms_opt_in'

const INSTAGRAM_HREF =
  process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim() || 'https://www.instagram.com/percyzerozero/'

type Props = {
  habits: RockHabit[]
  likedCardIds: readonly string[]
  visitedTipIds: ReadonlySet<string>
  onOpenTip: (tipId: string) => void
  /** Content Architect / Neon headlines by journey — polishes Rock tile faces to match Zone grid. */
  architectHeadlineByJourney?: Partial<Record<JourneyId, string>>
}

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 11-2.881 0 1.44 1.44 0 012.881 0z" />
    </svg>
  )
}

/** Mobile signup — static shell; hover only on input + Go button. */
export function RockMobileSignupCard({
  tips,
  tipSlugs,
  recommendations,
  userName,
}: {
  tips?: readonly SignupSmsItem[]
  tipSlugs?: readonly string[]
  recommendations?: readonly SignupSmsItem[]
  userName?: string
}) {
  const [mobile, setMobile] = useState('')
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [signupBusy, setSignupBusy] = useState(false)
  const [signupMsg, setSignupMsg] = useState<string | null>(null)
  const [smsSuccess, setSmsSuccess] = useState<{ title: string; subtitle: string } | null>(null)
  const [humanToken, setHumanToken] = useState<string | null>(null)
  const [honeypot, setHoneypot] = useState('')
  const humanCheckRequired = Boolean(turnstileSiteKey())

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROFILE_MOBILE_LS)
      if (saved) setMobile(saved)
      setSmsOptIn(localStorage.getItem(PROFILE_SMS_OPT_IN_LS) === '1')
    } catch {
      /* ignore */
    }
  }, [])

  const persistSmsOptIn = useCallback((next: boolean) => {
    setSmsOptIn(next)
    try {
      if (next) localStorage.setItem(PROFILE_SMS_OPT_IN_LS, '1')
      else localStorage.removeItem(PROFILE_SMS_OPT_IN_LS)
    } catch {
      /* ignore */
    }
  }, [])

  const submitMobile = useCallback(async () => {
    const raw = mobile.trim()
    if (!raw || signupBusy || !smsOptIn) return
    if (humanCheckRequired && !humanToken) {
      setSignupMsg('confirm you are human — complete the check below.')
      return
    }
    setSignupBusy(true)
    setSignupMsg(null)
    try {
      const res = await fetch('/api/profile/mobile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: raw,
          sms_opt_in: true,
          ...(honeypot.trim() ? { company_fax: honeypot.trim() } : {}),
          ...(humanToken ? { turnstile_token: humanToken } : {}),
          ...(userName?.trim() ? { userName: userName.trim() } : {}),
          ...(tips?.length ? { tips: [...tips] } : {}),
          ...(tipSlugs?.length ? { tipSlugs: [...tipSlugs] } : {}),
          ...(recommendations?.length ? { recommendations: [...recommendations] } : {}),
        }),
      })
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        persisted?: boolean
        mobile?: string
        welcome?: { sent?: boolean }
        sms?: { sent?: boolean; tipCount?: number; reason?: string; detail?: string }
      } | null
      if (res.status === 401) {
        setSignupMsg('complete your profile first — then we can text you your zone tips.')
        return
      }
      if (res.status === 400 && data?.sms?.reason === 'opt_in_required') {
        setSignupMsg('tick daily tips to receive texts.')
        return
      }
      if (!res.ok || !data?.ok) {
        setSignupMsg(
          data?.error === 'invalid mobile number'
            ? 'check your mobile number'
            : data?.error === 'could not verify — try again'
              ? 'confirm you are human — try again'
              : data?.error?.trim() || 'something went wrong — try again'
        )
        return
      }
      if (data.sms?.reason === 'opted_out') {
        setSignupMsg('this number opted out — text START to the zero zero number to rejoin.')
        return
      }
      const canonical = typeof data.mobile === 'string' ? data.mobile : raw
      try {
        localStorage.setItem(PROFILE_MOBILE_LS, canonical)
      } catch {
        /* ignore */
      }
      const smsSent = data.sms?.sent === true
      const welcomeSent = data.welcome?.sent === true
      setSignupMsg(null)
      if (smsSent && welcomeSent) {
        setSmsSuccess({
          title: 'text sent',
          subtitle: "check your messages for today's tips",
        })
      } else if (smsSent) {
        setSmsSuccess({
          title: 'text sent',
          subtitle: 'check your messages',
        })
      } else if (welcomeSent) {
        setSmsSuccess({
          title: 'welcome text sent',
          subtitle: 'check your messages',
        })
      } else {
        setSmsSuccess({
          title: "you're signed up",
          subtitle: "we'll text you when your tips are ready",
        })
      }
      setMobile('')
    } catch {
      setSignupMsg('something went wrong — try again')
    } finally {
      setSignupBusy(false)
    }
  }, [mobile, signupBusy, smsOptIn, tips, tipSlugs, recommendations, userName, humanToken, honeypot, humanCheckRequired])

  return (
    <div className="zone-rock-signup-wrap w-full box-border" aria-label="Mobile signup">
      <div
        className="rock-mobile-signup-card bento-card-groovy rock-bento-tile w-full flex flex-col border-0 text-left box-border"
        style={{
          backgroundColor: ROCK_CARD_BG,
          color: ROCK_CARD_TEXT,
          borderRadius: 60,
        }}
      >
        <h3 className="rock-mobile-signup-title zz-h3 m-0 tracking-wide text-marvin" lang="en" style={{ color: ROCK_CARD_TEXT }}>
          sign up with your mobile
        </h3>
        <h4 className="zz-h4 m-0 mt-1 rock-mobile-signup-sub" style={{ color: ROCK_CARD_TEXT, opacity: 0.92 }}>
          for tips and new offer drops
        </h4>
        <label className="rock-mobile-opt-in-row">
          <input
            type="checkbox"
            className="rock-mobile-opt-in-checkbox"
            checked={smsOptIn}
            onChange={(e) => persistSmsOptIn(e.target.checked)}
            aria-label="Opt in to daily tips and offers by text message"
          />
          <h4 className="rock-mobile-opt-in-label zz-h4 m-0">
            text me daily tips &amp; offers (reply STOP anytime)
          </h4>
        </label>
        <div className="rock-mobile-row">
          <input
            type="text"
            name="company_fax"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className="rock-mobile-honeypot"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
          />
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
            className="rock-mobile-send-btn"
            disabled={!mobile.trim() || !smsOptIn || signupBusy || (humanCheckRequired && !humanToken)}
            onClick={() => void submitMobile()}
            aria-label="Send mobile number"
            aria-busy={signupBusy}
          >
            <span className="zz-h4 rock-mobile-send-label">send</span>
          </button>
        </div>
        {humanCheckRequired ? (
          <>
            <h4 className="zz-h4 m-0 mt-2" style={{ color: ROCK_CARD_TEXT }}>
              confirm you are human
            </h4>
            <HumanCheckTurnstile onToken={setHumanToken} className="rock-mobile-human-check" />
          </>
        ) : null}
        {signupMsg ? (
          <h4 className="zz-h4 m-0 mt-3" style={{ color: ROCK_CARD_TEXT }}>
            {signupMsg}
          </h4>
        ) : null}

        <h4 className="zz-h4 m-0 mt-2">
          <Link href={ROUTES.PRIVACY} className="rock-mobile-privacy-link">
            privacy &amp; data
          </Link>
        </h4>

        <div className="rock-social-row">
          <a
            href={INSTAGRAM_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="rock-ig-link"
            aria-label="Zero Zero on Instagram"
          >
            <InstagramGlyph className="rock-ig-link__glyph" />
          </a>
        </div>
      </div>

      {smsSuccess ? (
        <FixedViewportPortal>
          <div className="rock-sms-success-overlay" role="presentation">
            <div
              className="rock-sms-success-card bento-card-groovy rock-bento-tile"
              role="dialog"
              aria-modal
              aria-labelledby="rock-sms-success-title"
              style={{
                backgroundColor: ROCK_CARD_BG,
                color: ROCK_CARD_TEXT,
                borderRadius: 60,
              }}
            >
              <button
                type="button"
                className="zz-close-btn rock-sms-success-close"
                aria-label="Close"
                onClick={() => setSmsSuccess(null)}
              >
                <CloseXOutlineIcon size={18} />
              </button>
              <h3
                id="rock-sms-success-title"
                className="rock-mobile-signup-title zz-h3 m-0 tracking-wide text-marvin"
                style={{ color: ROCK_CARD_TEXT }}
              >
                {smsSuccess.title}
              </h3>
              <h4 className="zz-h4 m-0 rock-sms-success-sub" style={{ color: ROCK_CARD_TEXT, opacity: 0.92 }}>
                {smsSuccess.subtitle}
              </h4>
            </div>
          </div>
        </FixedViewportPortal>
      ) : null}
    </div>
  )
}

/**
 * The Rock — six saving-tip tiles: same bento shell as Zone (yellow / purple, `bento-card-groovy`).
 * Grid: 1 col mobile / 2 tablet / 3 desktop (matches Zone rhythm below XL).
 */
export function RockSavingTips({
  habits,
  likedCardIds,
  visitedTipIds,
  onOpenTip,
}: Props) {
  const six = habits.slice(0, 6)

  if (six.length === 0) return null

  return (
    <section className="rock-saving-tips-section w-full text-left pt-2 box-border" aria-label="Today's tips">
      <div className="groovy-zone-grid mx-auto w-full rock-saving-tips-grid">
        {six.map((h) => {
          const tip = habitToTipCard(h)
          const liked = likedCardIds.includes(tip.id)
          const visited = visitedTipIds.has(tip.id)
          const tipBg = visited ? ROCK_CARD_BG : 'var(--color-purple)'
          const tipInk = 'var(--color-yellow)' as const
          const jid = h.journey_key
          const tipHeadline = clampRockTipHeadline(h.title)
          const gbp = parseMoneyGbpFromDisplay(String(tip.data.money ?? '0'))
          const kg = parseCarbonKgFromDisplay(String(tip.data.carbon ?? '0'))

          return (
            <button
              key={tip.id}
              type="button"
              id={zoneCardDomId(tip.id)}
              onClick={() => onOpenTip(tip.id)}
              data-zone-surface="tip"
              className={[
                'bento-card-groovy rock-bento-tile groovy-cell-radius flex flex-col justify-between w-full h-full min-h-0 cursor-pointer border-0 text-left',
                visited ? 'zone-card--visited' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                ['--journey-bg' as string]: tipBg,
                ['--journey-text' as string]: tipInk,
                ['--color-ink' as string]: tipInk,
                borderRadius: 60,
                boxShadow: 'none',
              }}
            >
              <ZoneBentoCardHeader journeyId={jid ?? 'carbon'} />
              <h3 className="card-headline m-0 min-w-0" lang="en">
                {tipHeadline}
              </h3>
              <div className="card-impact-grid grid grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-0 mt-auto shrink-0">
                <div className="data-stack data-stack--tight">
                  <span className="data-label" style={{ color: tipInk }}>
                    SAVE
                  </span>
                  <span className="data-value text-data data-stamp-metric" style={{ color: 'var(--color-ink)' }}>
                    <StampedMoneyGbp gbp={gbp} />
                  </span>
                </div>
                <div className="data-stack data-stack--tight">
                  <span className="data-label" style={{ color: tipInk }}>
                    CARBON
                  </span>
                  <span className="data-value text-data data-stamp-metric" style={{ color: 'var(--color-ink)' }}>
                    <StampedCarbonKg kg={kg} />
                    {liked ? (
                      <span className="rock-tip-liked-disc" aria-label="Liked">
                        <HeartOutlineIcon size={14} style={{ color: 'var(--color-purple)' }} />
                      </span>
                    ) : null}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
