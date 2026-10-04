'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ZoneRecCard } from '@/app/components/ZoneRecCard'
import { railDomId, type ZoneRail, type ZoneRailsLayout } from '@/lib/zone/rails'
import type { RecCardCta, RecCardModel } from '@/lib/zone/recCard'
import { ROUTES } from '@/lib/routes'

type Props = {
  layout: ZoneRailsLayout
  visitedIds?: ReadonlySet<string>
  onOpen: (card: RecCardModel) => void
  onCta?: (card: RecCardModel, cta: RecCardCta) => void
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function Rail({ rail, visitedIds, onOpen, onCta }: { rail: ZoneRail } & Omit<Props, 'layout'>) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const measure = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    measure()
    const el = scrollerRef.current
    if (!el) return
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [measure, rail.cards.length])

  const page = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  const headingId = `${railDomId(rail.id)}-title`
  return (
    <section
      id={railDomId(rail.id)}
      className="zone-rail"
      data-testid={`zone-rail-${rail.id}`}
      aria-labelledby={headingId}
    >
      <div className="zone-rail-head">
        <h3 id={headingId} className="zone-rail-title m-0">
          {rail.title}
        </h3>
        <div className="zone-rail-arrows" aria-hidden={false}>
          <button
            type="button"
            className="zone-rail-arrow"
            aria-label={`Scroll ${rail.title} left`}
            disabled={!canPrev}
            onClick={() => page(-1)}
          >
            ←
          </button>
          <button
            type="button"
            className="zone-rail-arrow"
            aria-label={`Scroll ${rail.title} right`}
            disabled={!canNext}
            onClick={() => page(1)}
          >
            →
          </button>
        </div>
      </div>
      <div
        ref={scrollerRef}
        className="zone-rail-scroller"
        role="region"
        aria-label={rail.ariaLabel}
        tabIndex={0}
        onScroll={measure}
      >
        {rail.cards.map((card) => (
          <div key={card.id} className={`zone-rail-item zone-rail-item--${card.size}`}>
            <ZoneRecCard card={card} visited={visitedIds?.has(card.id)} onOpen={onOpen} onCta={onCta} />
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Zone rails: Biggest savings, Today, one rail per category (≥2 cards). Horizontal scroll-snap,
 * peeking next card on mobile, arrow buttons on desktop, no auto-advance. Category pills jump to
 * their rail; they do not filter.
 */
export function ZoneRails({ layout, visitedIds, onOpen, onCta }: Props) {
  const jump = (railId: string) => {
    const el = document.getElementById(railDomId(railId))
    if (!el) return
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    el.querySelector<HTMLElement>('.zone-rail-scroller')?.focus({ preventScroll: true })
  }

  if (layout.rails.length === 0) {
    return (
      <div className="zone-rails zone-rails--empty" data-testid="zone-rails-empty">
        <p className="m-0">Tell us your postcode and we&apos;ll show what applies to your home.</p>
        <Link href={ROUTES.START} className="entry-text-link">
          Add your postcode
        </Link>
      </div>
    )
  }

  return (
    <div className="zone-rails" data-testid="zone-rails">
      {layout.pills.length > 0 ? (
        <nav className="zone-rail-pills" aria-label="Jump to a category">
          {layout.pills.map((p) => (
            <button key={p.id} type="button" className="zone-pill zz-label" onClick={() => jump(p.railId)}>
              {p.label}
            </button>
          ))}
        </nav>
      ) : null}
      {layout.rails.map((rail) => (
        <Rail key={rail.id} rail={rail} visitedIds={visitedIds} onOpen={onOpen} onCta={onCta} />
      ))}
    </div>
  )
}
