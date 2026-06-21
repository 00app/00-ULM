/**
 * Phase 0 funnel schema — event names + server-side payload sanitization.
 * Client posts via `trackFunnelEvent` → POST `/api/analytics`.
 */

export const FUNNEL_EVENT_NAMES = [
  'intro_complete',
  'profile_complete',
  'summary_enter_zone',
  'zone_ready',
  'solo_focus_open',
  'solo_focus_close',
  'answer_committed',
  'discovery_injected',
  'cta_click',
] as const

export type FunnelEventName = (typeof FUNNEL_EVENT_NAMES)[number]

export type FunnelCardType = 'journey' | 'tip' | 'discovery'

export type FunnelEventProps = {
  page?: string
  card_id?: string
  card_type?: FunnelCardType
  journey_id?: string
  target_url?: string
  money_value?: number
  cta_label?: string
  skipped?: boolean
}

const FUNNEL_SET = new Set<string>(FUNNEL_EVENT_NAMES)

export function isFunnelEventName(value: string): value is FunnelEventName {
  return FUNNEL_SET.has(value)
}

const ANALYTICS_SESSION_KEY = 'zz_analytics_session_v1'

function randomSessionSuffix(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** Stable per-tab session id for funnel correlation. */
export function getOrCreateAnalyticsSessionId(): string {
  if (typeof window === 'undefined') return 'server'
  try {
    const existing = sessionStorage.getItem(ANALYTICS_SESSION_KEY)
    if (existing && existing.length >= 8) return existing
    const id = randomSessionSuffix()
    sessionStorage.setItem(ANALYTICS_SESSION_KEY, id)
    return id
  } catch {
    return randomSessionSuffix()
  }
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max)
}

export function sanitizeFunnelProps(raw: unknown): FunnelEventProps {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const out: FunnelEventProps = {}

  if (typeof o.page === 'string' && o.page.trim()) out.page = clip(o.page.trim(), 200)
  if (typeof o.card_id === 'string' && o.card_id.trim()) out.card_id = clip(o.card_id.trim(), 120)
  if (o.card_type === 'journey' || o.card_type === 'tip' || o.card_type === 'discovery') {
    out.card_type = o.card_type
  }
  if (typeof o.journey_id === 'string' && o.journey_id.trim()) {
    out.journey_id = clip(o.journey_id.trim(), 40)
  }
  if (typeof o.target_url === 'string' && o.target_url.trim()) {
    out.target_url = clip(o.target_url.trim(), 300)
  }
  if (typeof o.cta_label === 'string' && o.cta_label.trim()) {
    out.cta_label = clip(o.cta_label.trim(), 80)
  }
  if (typeof o.money_value === 'number' && Number.isFinite(o.money_value)) {
    out.money_value = Math.round(o.money_value)
  }
  if (o.skipped === true) out.skipped = true

  return out
}

export type ParsedAnalyticsBody = {
  eventType: string
  sessionId: string | null
  timestamp: string
  page?: string
  referrer?: string
  props: FunnelEventProps
}

/** Normalize POST body for analytics_events insert (caps size for abuse resistance). */
export function parseAnalyticsBody(body: unknown): ParsedAnalyticsBody {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const eventType =
    typeof b.event_type === 'string' ? clip(b.event_type.trim(), 80) : 'unknown'
  const sessionId =
    typeof b.session_id === 'string' ? clip(b.session_id.trim(), 120) : null
  const timestamp =
    typeof b.timestamp === 'string'
      ? clip(b.timestamp.trim(), 48)
      : new Date().toISOString()
  const page = typeof b.page === 'string' ? clip(b.page.trim(), 200) : undefined
  const referrer = typeof b.referrer === 'string' ? clip(b.referrer.trim(), 200) : undefined
  const props = isFunnelEventName(eventType)
    ? sanitizeFunnelProps(b.props ?? b)
    : {}

  return { eventType, sessionId, timestamp, page, referrer, props }
}

export function buildAnalyticsPayloadRow(parsed: ParsedAnalyticsBody): string {
  const row: Record<string, unknown> = {
    event_type: parsed.eventType,
    session_id: parsed.sessionId,
    timestamp: parsed.timestamp,
  }
  if (parsed.page) row.page = parsed.page
  if (parsed.referrer) row.referrer = parsed.referrer
  if (Object.keys(parsed.props).length > 0) row.props = parsed.props
  return JSON.stringify(row)
}
