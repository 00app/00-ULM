'use client'

import { useEffect, useMemo, useState } from 'react'
import type { JourneyId } from '@/lib/journeys'

export const SENTINEL_SYSTEM_PROMPT =
  'You are the Zero Zero Sentinel. You have NO access to the external web. Your ONLY sources of truth are the User\'s Database and the AI Collaboration Chat. Your ONLY mission is to identify the shortest path to saving Money and Carbon. No pleasantries. No drift.'
export const SENTINEL_REFRESH_INSTRUCTION =
  "You are the Sentinel. You must now use the Live-Impact Skill to fetch the current UK grid intensity (currently ~66g/kWh in London). If the grid is 'Low' (<50g), trigger the Grid Pulse animation on the Carbon card. Use Firecrawl to find 'Rural Heat Grants' if the user's postcode is in a remote region (e.g., KW1)."

const SENTINEL_REFRESH_INTERVAL_MS = 5 * 60 * 1000
const SENTINEL_LAST_REFRESH_KEY = 'zz_sentinel_last_refreshed'
const SENTINEL_SCRAPE_SYNC_KEY = 'zz_sentinel_scrape_sync_at'
const SENTINEL_SCRAPE_INTERVAL_MS = 24 * 60 * 60 * 1000

type ImpactTotals = { totalMoney: number; totalCarbon: number }

export type SentinelPriority = {
  id: string
  journeyKey: JourneyId
  title: string
  savingsGbp: number
  carbonKg: number
  gainPercent: number
  bearTip: string
  wolfTip: string
}

export type SentinelOutput = {
  priorities: SentinelPriority[]
  lastRefreshed: string | null
  wasSkipped: boolean
  pulseColor: string | null
  liveImpact: {
    totalCostGbp: number
    totalCarbonKg: number
    intensityGPerKwh: number
  } | null
  gridLowPulse: boolean
  grantFound: boolean
  firecrawlGrant: {
    title: string
    claimOfferUrl: string
    totalRuralGrantGbp: number | null
  } | null
}

type UseSentinelParams = {
  userAnswers: Record<string, Record<string, string>>
  impactTotals: ImpactTotals
  recentChatHistory: Array<{ role: 'user' | 'zai'; text: string }>
}

function parseProfileGoal(): 'money' | 'carbon' | 'balanced' {
  if (typeof window === 'undefined') return 'balanced'
  const raw = (window.localStorage.getItem('profile_goal') ?? '').toLowerCase()
  if (raw.includes('money') || raw.includes('save')) return 'money'
  if (raw.includes('carbon') || raw.includes('co2')) return 'carbon'
  return 'balanced'
}

function countAnswers(userAnswers: Record<string, Record<string, string>>): number {
  return Object.values(userAnswers).reduce((acc, item) => acc + Object.keys(item ?? {}).length, 0)
}

function buildPriorities(params: UseSentinelParams): SentinelPriority[] {
  const answerCount = countAnswers(params.userAnswers)
  const goal = parseProfileGoal()
  const chat = params.recentChatHistory.map((m) => m.text.toLowerCase()).join(' ')
  const leansHeating = /(heat|heating|boiler|insulation|draft|cold)/.test(chat)
  const leansCommute = /(commute|travel|bus|car|petrol|train)/.test(chat)
  const leansWaste = /(waste|food|bin|recycle|shopping)/.test(chat)

  const moneyDelta = Math.max(0, params.impactTotals.totalMoney * 0.2)
  const carbonDelta = Math.max(0, params.impactTotals.totalCarbon * 0.2)
  const base = Math.max(1, answerCount || 1)

  const candidates: SentinelPriority[] = [
    {
      id: 'sentinel-home',
      journeyKey: 'home',
      title: leansHeating ? 'Fix Heat Leak' : 'Seal Home Energy Drift',
      savingsGbp: Math.round((moneyDelta * 0.36 + base * 12) * 10) / 10,
      carbonKg: Math.round((carbonDelta * 0.34 + base * 9) * 10) / 10,
      gainPercent: 12,
      bearTip: 'Data shows 12% inefficiency in Heating. Resolve now.',
      wolfTip: 'Asset leakage detected in Utility spend. Optimize for 4.2% gain.',
    },
    {
      id: 'sentinel-travel',
      journeyKey: 'travel',
      title: leansCommute ? 'Optimize Commute' : 'Compress Travel Burn',
      savingsGbp: Math.round((moneyDelta * 0.32 + base * 9) * 10) / 10,
      carbonKg: Math.round((carbonDelta * 0.31 + base * 7) * 10) / 10,
      gainPercent: 9,
      bearTip: 'Route analysis shows avoidable commute drag. Shift mode this week.',
      wolfTip: 'Commute overhead detected. Reallocate transit mix for faster yield.',
    },
    {
      id: 'sentinel-waste',
      journeyKey: leansWaste ? 'waste' : 'shopping',
      title: leansWaste ? 'Stop Waste Bleed' : 'Reduce Basket Friction',
      savingsGbp: Math.round((moneyDelta * 0.29 + base * 8) * 10) / 10,
      carbonKg: Math.round((carbonDelta * 0.28 + base * 6) * 10) / 10,
      gainPercent: 7,
      bearTip: 'Waste stream shows repeat leakage. Tighten purchase and reuse loops.',
      wolfTip: 'Consumption inefficiency flagged. Trim low-value spend and recover margin.',
    },
  ]

  if (goal === 'money') {
    return candidates.sort((a, b) => b.savingsGbp - a.savingsGbp).slice(0, 3)
  }
  if (goal === 'carbon') {
    return candidates.sort((a, b) => b.carbonKg - a.carbonKg).slice(0, 3)
  }
  return candidates
}

export function useSentinel(params: UseSentinelParams): SentinelOutput {
  const { userAnswers, impactTotals, recentChatHistory } = params
  const userAnswersKey = useMemo(() => JSON.stringify(userAnswers ?? {}), [userAnswers])
  const recentChatKey = useMemo(() => JSON.stringify(recentChatHistory ?? []), [recentChatHistory])
  const totalMoney = impactTotals.totalMoney
  const totalCarbon = impactTotals.totalCarbon
  const [priorities, setPriorities] = useState<SentinelPriority[]>([])
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null)
  const [wasSkipped, setWasSkipped] = useState(false)
  const [pulseColor, setPulseColor] = useState<string | null>(null)
  const [liveImpact, setLiveImpact] = useState<{
    totalCostGbp: number
    totalCarbonKg: number
    intensityGPerKwh: number
  } | null>(null)
  const [gridLowPulse, setGridLowPulse] = useState(false)
  const [grantFound, setGrantFound] = useState(false)
  const [firecrawlGrant, setFirecrawlGrant] = useState<SentinelOutput['firecrawlGrant']>(null)

  const computedPriorities = useMemo(
    () =>
      buildPriorities({
        userAnswers: JSON.parse(userAnswersKey) as Record<string, Record<string, string>>,
        impactTotals: { totalMoney, totalCarbon },
        recentChatHistory: JSON.parse(recentChatKey) as Array<{ role: 'user' | 'zai'; text: string }>,
      }),
    [recentChatKey, totalCarbon, totalMoney, userAnswersKey]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const now = Date.now()
    const previous = Number.parseInt(window.localStorage.getItem(SENTINEL_LAST_REFRESH_KEY) ?? '0', 10)
    if (Number.isFinite(previous) && previous > 0 && now - previous < SENTINEL_REFRESH_INTERVAL_MS) {
      setPriorities(computedPriorities)
      setLastRefreshed(new Date(previous).toISOString())
      setWasSkipped(true)
      return
    }

    setPriorities(computedPriorities)
    setWasSkipped(false)
    const shouldRunScrapeSync =
      now - Number.parseInt(window.localStorage.getItem(SENTINEL_SCRAPE_SYNC_KEY) ?? '0', 10) >
      SENTINEL_SCRAPE_INTERVAL_MS
    const region =
      window.localStorage.getItem('profile_region') ??
      window.localStorage.getItem('profile_location_region') ??
      undefined
    fetch('/api/sentinel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        priorities: computedPriorities,
        system_prompt: SENTINEL_SYSTEM_PROMPT,
        sentinel_instruction: SENTINEL_REFRESH_INSTRUCTION,
        region,
        run_scrape_sync: shouldRunScrapeSync,
      }),
    })
      .then(async (r) => {
        if (!r.ok) return null
        return r.json()
      })
      .then((data) => {
        if (Array.isArray(data?.priorities)) {
          setPriorities(data.priorities as SentinelPriority[])
        }
        const refreshedAt =
          typeof data?.last_refreshed === 'string' && data.last_refreshed
            ? data.last_refreshed
            : new Date().toISOString()
        if (typeof data?.liveImpact?.grid?.pulseColor === 'string') {
          setPulseColor(data.liveImpact.grid.pulseColor)
        }
        setGridLowPulse(Boolean(data?.grid_low))
        setGrantFound(Boolean(data?.grant_found))
        if (data?.firecrawl_grant && typeof data.firecrawl_grant === 'object') {
          const grant = data.firecrawl_grant as Record<string, unknown>
          setFirecrawlGrant({
            title: typeof grant.title === 'string' && grant.title.trim() ? grant.title : 'LIVE HEAT UPGRADE GRANT',
            claimOfferUrl: typeof grant.claimOfferUrl === 'string' ? grant.claimOfferUrl : '',
            totalRuralGrantGbp:
              typeof grant.totalRuralGrantGbp === 'number' ? grant.totalRuralGrantGbp : null,
          })
        }
        if (
          typeof data?.liveImpact?.homeIdle24h?.totalCostGbp === 'number' &&
          typeof data?.liveImpact?.homeIdle24h?.totalCarbonKg === 'number' &&
          typeof data?.liveImpact?.grid?.intensityGPerKwh === 'number'
        ) {
          setLiveImpact({
            totalCostGbp: data.liveImpact.homeIdle24h.totalCostGbp,
            totalCarbonKg: data.liveImpact.homeIdle24h.totalCarbonKg,
            intensityGPerKwh: data.liveImpact.grid.intensityGPerKwh,
          })
        }
        if (shouldRunScrapeSync) {
          window.localStorage.setItem(SENTINEL_SCRAPE_SYNC_KEY, String(Date.now()))
          // Refresh in-grid tips after 24h sync pull so grant cards can surface.
          void fetch('/api/zone/tips-refresh', { method: 'POST', credentials: 'include' }).catch(() => {})
        }
        setLastRefreshed(refreshedAt)
        window.localStorage.setItem(SENTINEL_LAST_REFRESH_KEY, String(Date.parse(refreshedAt) || Date.now()))
      })
      .catch(() => {
        const fallback = new Date().toISOString()
        setLastRefreshed(fallback)
        window.localStorage.setItem(SENTINEL_LAST_REFRESH_KEY, String(Date.now()))
      })
  }, [computedPriorities, userAnswersKey, recentChatKey, totalMoney, totalCarbon])

  return { priorities, lastRefreshed, wasSkipped, pulseColor, liveImpact, gridLowPulse, grantFound, firecrawlGrant }
}
