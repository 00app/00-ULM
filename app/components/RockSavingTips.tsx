'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
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
import { isValidUkMobileInput } from '@/lib/messaging/ukMobile'
import { ensureProfileSession } from '@/lib/client/ensureProfileSession'
import { authenticatedPost } from '@/lib/client/authenticatedFetch'

/** Industrial lock: Tips/settings are pink base with yellow items. */
const ROCK_CARD_BG = 'var(--color-pink)' as const
const ROCK_CARD_TEXT = 'var(--color-yellow)' as const

const PROFILE_SMS_OPT_IN_LS = 'zz_profile_sms_opt_in'

type Props = {
  habits: RockHabit[]
  likedCardIds: readonly string[]
  visitedTipIds: ReadonlySet<string>
  onOpenTip: (tipId: string) => void
  /** Content Architect / Neon headlines by journey — polishes Rock tile faces to match Zone grid. */
  architectHeadlineByJourney?: Partial<Record<JourneyId, string>>
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
  const mobileReady = useMemo(() => isValidUkMobileInput(mobile), [mobile])

  useEffect(() => {
    try {
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
    if (!raw || !isValidUkMobileInput(raw) || signupBusy || !smsOptIn) return
    if (humanCheckRequired && !humanToken) {
      setSignupMsg('confirm you are human — complete the check below.')
      return
    }
    setSignupBusy(true)
    setSignupMsg(null)
    try {
      await ensureProfileSession()

      let res = await authenticatedPost('/api/profile/mobile', {
        mobile: raw,
        sms_opt_in: true,
        ...(honeypot.trim() ? { company_fax: honeypot.trim() } : {}),
        ...(humanToken ? { turnstile_token: humanToken } : {}),
        ...(userName?.trim() ? { userName: userName.trim() } : {}),
        ...(tips?.length ? { tips: [...tips] } : {}),
        ...(tipSlugs?.length ? { tipSlugs: [...tipSlugs] } : {}),
        ...(recommendations?.length ? { recommendations: [...recommendations] } : {}),
      })
      if (res.status === 401) {
        const restored = await ensureProfileSession({ forceRestore: true })
        if (restored) {
          res = await authenticatedPost('/api/profile/mobile', {
            mobile: raw,
            sms_opt_in: true,
            ...(honeypot.trim() ? { company_fax: honeypot.trim() } : {}),
            ...(humanToken ? { turnstile_token: humanToken } : {}),
            ...(userName?.trim() ? { userName: userName.trim() } : {}),
            ...(tips?.length ? { tips: [...tips] } : {}),
            ...(tipSlugs?.length ? { tipSlugs: [...tipSlugs] } : {}),
            ...(recommendations?.length ? { recommendations: [...recommendations] } : {}),
          })
        }
      }
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        persisted?: boolean
        mobile_saved?: boolean
        mobile_last4?: string
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
      } else if (data.sms?.sent === false) {
        setSignupMsg(
          data.sms.reason === 'missing_credentials' ||
            data.sms.reason === 'missing_from_number' ||
            data.sms.reason === 'messaging_disabled'
            ? 'number saved — texts are warming up. try again in a minute.'
            : data.sms.reason === 'send_failed'
              ? 'number saved — text failed to send. try again.'
              : 'number saved — we could not send a text right now. try again.'
        )
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
        <label className="rock-mobile-opt-in-row">
          <input
            type="checkbox"
            className="rock-mobile-opt-in-checkbox"
            checked={smsOptIn}
            onChange={(e) => persistSmsOptIn(e.target.checked)}
            aria-label="Opt in to daily tips and offers by text message"
          />
          <h4 className="rock-mobile-opt-in-label zz-h4 m-0">
            text me daily tips &amp; offers
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
            onAdvance={mobileReady ? submitMobile : undefined}
            placeholder="UK mobile"
            className="rock-mobile-zz-input"
            width="100%"
          />
          {mobileReady ? (
            <button
              type="button"
              className="rock-mobile-send-btn"
              disabled={!smsOptIn || signupBusy || (humanCheckRequired && !humanToken)}
              onClick={() => void submitMobile()}
              aria-label="Send mobile number"
              aria-busy={signupBusy}
            >
              <span className="zz-h4 rock-mobile-send-label">send</span>
            </button>
          ) : (
            <button
              type="button"
              className="rock-mobile-send-btn"
              disabled
              aria-label="Enter a valid UK mobile number"
            >
              <span className="zz-h4 rock-mobile-send-label">send</span>
            </button>
          )}
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

        <div className="rock-mobile-privacy-block">
          <h4 className="zz-h4 m-0 mt-2 rock-mobile-privacy-head">
            <Link href={ROUTES.PRIVACY} className="rock-mobile-privacy-link">
              privacy &amp; data
            </Link>
          </h4>
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
    <section className="rock-saving-tips-section w-full text-left box-border" aria-label="Today's tips">
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
