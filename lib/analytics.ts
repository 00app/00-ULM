// Zero Zero Analytics - Ethical tracking only
// Fire-and-forget, non-blocking, anonymous by default

type EventType =
  | 'session_start'
  | 'session_end'
  | 'intro_viewed'
  | 'intro_skipped'
  | 'profile_started'
  | 'profile_completed'
  | 'question_answered'
  | 'journey_started'
  | 'journey_completed'
  | 'journey_continued'
  | 'space_viewed'
  | 'card_impression'
  | 'card_opened'
  | 'sheet_closed'
  | 'card_liked'
  | 'card_unliked'
  | 'card_learn_clicked'
  | 'card_cta_clicked'
  | 'likes_viewed'
  | 'liked_card_opened'
  | 'zai_opened'
  | 'zai_question_asked'
  | 'zai_card_referenced'

interface EventPayload {
  [key: string]: string | number | boolean | undefined
}

class Analytics {
  private sessionId: string
  private sessionStartTime: number
  private trackedCards: Set<string> = new Set()

  constructor() {
    this.sessionId = this.generateSessionId()
    this.sessionStartTime = Date.now()
    this.track('session_start', {
      session_id: this.sessionId,
      device_type: this.getDeviceType(),
      first_time: !this.hasVisitedBefore(),
    })
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getDeviceType(): 'mobile' | 'desktop' {
    if (typeof window === 'undefined') return 'desktop'
    return window.innerWidth < 768 ? 'mobile' : 'desktop'
  }

  private hasVisitedBefore(): boolean {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('zero_zero_visited') === 'true'
  }

  private markVisited(): void {
    if (typeof window === 'undefined') return
    localStorage.setItem('zero_zero_visited', 'true')
  }

  // Fire-and-forget analytics - never blocks UI
  track(eventType: EventType, payload: EventPayload = {}): void {
    // Fail silently if analytics unavailable
    try {
      const event = {
        event_type: eventType,
        session_id: this.sessionId,
        timestamp: new Date().toISOString(),
        ...payload,
      }

      // Send to API endpoint (fire-and-forget)
      if (typeof window !== 'undefined') {
        fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
          keepalive: true, // Ensure request completes even if page unloads
        }).catch(() => {
          // Silently fail - analytics never blocks
        })
      }

      // Mark first visit
      if (eventType === 'session_start') {
        this.markVisited()
      }

      // Track session end on unload
      if (eventType === 'session_start' && typeof window !== 'undefined') {
        window.addEventListener('beforeunload', () => {
          this.track('session_end', {
            session_id: this.sessionId,
            duration_ms: Date.now() - this.sessionStartTime,
          })
        })
      }
    } catch (error) {
      // Silently fail - analytics never blocks
    }
  }

  // Track card impression (once per session per card)
  trackCardImpression(cardId: string, cardType: string, journeyId?: string): void {
    if (this.trackedCards.has(cardId)) return

    this.trackedCards.add(cardId)
    this.track('card_impression', {
      card_id: cardId,
      card_type: cardType,
      journey_id: journeyId,
    })
  }
}

// Singleton instance
let analyticsInstance: Analytics | null = null

export function getAnalytics(): Analytics {
  if (typeof window === 'undefined') {
    // Server-side: return mock that does nothing
    return {
      track: () => {},
      trackCardImpression: () => {},
      sessionId: '',
      sessionStartTime: 0,
      trackedCards: new Set(),
      generateSessionId: () => '',
      getDeviceType: () => 'desktop' as const,
      hasVisitedBefore: () => false,
      markVisited: () => {},
    } as unknown as Analytics
  }

  if (!analyticsInstance) {
    analyticsInstance = new Analytics()
  }

  return analyticsInstance
}

// Convenience functions
export function trackEvent(eventType: EventType, payload?: EventPayload): void {
  getAnalytics().track(eventType, payload)
}

export function trackCardImpression(cardId: string, cardType: string, journeyId?: string): void {
  getAnalytics().trackCardImpression(cardId, cardType, journeyId)
}
