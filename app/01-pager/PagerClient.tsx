'use client'

import { useState, useCallback } from 'react'
import { PAGER_CARDS, PAGER_CONTACT, PAGER_DOORS, type PagerCard } from './pagerData'
import { ZoneBentoCardHeader } from '@/app/components/ui/ZoneBentoCardHeader'
import styles from './pager.module.css'

/**
 * Interactive one-pager.
 *
 * The interaction carries the argument. Front of a card is the claim, back is the proof, and the
 * page therefore behaves the way the product does: nothing asserted without a source. Someone
 * tapping through to check where £24bn came from is not reading a pitch, they are using a
 * miniature of the thing being pitched.
 *
 * The nine cards are real Zone bento cards: `groovy-zone-grid`, `bento-card-groovy`,
 * `card-headline`, `data-value`, and `ZoneBentoCardHeader` for the category row, imported and
 * applied exactly as the live wall does, not approximated in a parallel stylesheet. Only the
 * page shell, the doors/contact sections and the tap-to-reveal accordion are this folder's own
 * CSS (pager.module.css) — Zone's own "expand" is the full Solo Focus overlay, wired to session
 * and research state a static page cannot have, so this is a small CSS-only accordion instead of
 * an attempt to fake that.
 */
export default function PagerClient() {
  const [open, setOpen] = useState<string | null>(null)

  const toggle = useCallback((id: string) => {
    setOpen((cur) => (cur === id ? null : id))
  }, [])

  return (
    <main className={styles.pager}>
      <header className={styles.header}>
        <Mark className={styles.logo} />
        <h1 className={styles.title}>
          UK households are owed
          <br />
          <span className={styles.titleAccent}>£24 billion a year.</span>
          <br />
          Most never claim it.
        </h1>
        <p className={styles.sub}>
          Tap any card to see where the number comes from. Every claim on this page has a source,
          which is the same rule the product runs on.
        </p>
      </header>

      <section className="groovy-zone-grid" aria-label="Zero Zero in nine facts">
        {PAGER_CARDS.map((card) => (
          <Card key={card.id} card={card} isOpen={open === card.id} onToggle={toggle} />
        ))}
      </section>

      <section className={styles.doors} aria-label="What we are looking for">
        <h2 className={styles.doorsTitle}>Two doors</h2>
        <div className={styles.doorsGrid}>
          {PAGER_DOORS.map((d) => (
            <div key={d.label} className={styles.door}>
              <p className={styles.doorLabel}>{d.label}</p>
              <p className={styles.doorBody}>{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className={styles.contact}>
        <p className={styles.contactTitle}>Get in touch</p>
        <div className={styles.contactRows}>
          <a className={styles.contactLink} href={`mailto:${PAGER_CONTACT.email}`}>
            {PAGER_CONTACT.email}
          </a>
          <span className={styles.contactSite}>{PAGER_CONTACT.site}</span>
        </div>
        <p className={styles.contactName}>{PAGER_CONTACT.name}</p>
      </footer>
    </main>
  )
}

/**
 * The Zero Zero brand mark, top right of the header. Same paths as app/components/Logo.tsx's
 * static (non-animated) export, copied rather than imported so this folder stays sealed: no
 * cross-import into the rest of the app, nothing to break if Logo.tsx ever changes shape.
 */
function Mark({ className }: { className?: string }) {
  return (
    <svg width={40} viewBox="0 0 126 200" fill="none" className={className} aria-hidden>
      <path
        d="M0 197.167C0 197.167 116.049 2.82119 117.721 0L119.361 1.36232L3.47311 200L0 197.167Z"
        fill="currentColor"
      />
      <path
        d="M32.146 135.623C34.9864 130.775 38.0841 125.476 41.4176 119.79C39.4346 111.584 38.5664 102.134 38.5664 92.265C38.5664 63.7742 45.5228 38.0188 67.6674 38.0188C74.9131 38.0188 80.4975 40.8936 84.7957 45.6886C85.8997 43.8006 87.0037 41.9234 88.1077 40.0355C81.773 37.5361 74.8917 36.1201 67.6781 36.1201C36.6799 36.1201 11.577 61.4465 11.577 92.265C11.577 109.771 19.616 125.336 32.146 135.623Z"
        fill="currentColor"
      />
      <path
        d="M93.0511 43.083L37.0465 139.69C37.2501 139.829 37.4538 139.969 37.6574 140.055C46.779 146.48 57.8834 150.288 69.8989 150.288C100.897 150.288 126 125.176 126 94.1433C126 71.5416 112.473 51.9435 93.0511 43.0723M69.9096 148.4C57.8084 148.4 50.2732 140.752 45.8893 129.156C57.4975 109.601 81.893 67.9695 90.8216 52.7265C96.7383 62.9279 99.0106 78.1065 99.0106 94.1647C99.0106 122.87 91.8399 148.411 69.9096 148.411"
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * Tone → the real 3-colour cascade, via the same attribute/class combination a live card uses
 * (globals.css), not a hand-written background/colour rule: journey (default) is purple on
 * yellow text; `data-zone-surface="tip"` is pink on yellow text; adding `zone-card--discovery`
 * on top of that flips it to yellow on purple text. Three tones, zero new colour declarations.
 */
function toneAttrs(tone: PagerCard['tone']): { 'data-zone-surface'?: 'tip' | 'journey'; className?: string } {
  if (tone === 'pink') return { 'data-zone-surface': 'tip' }
  if (tone === 'yellow') return { 'data-zone-surface': 'tip', className: 'zone-card--discovery' }
  return { 'data-zone-surface': 'journey' }
}

function Card({
  card,
  isOpen,
  onToggle,
}: {
  card: PagerCard
  isOpen: boolean
  onToggle: (id: string) => void
}) {
  const tone = toneAttrs(card.tone)
  const cls = [
    'bento-card-groovy',
    styles.cardReset,
    tone.className ?? '',
    card.span === 'wide' ? 'span-wide' : '',
    isOpen ? styles.isOpen : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={cls}
      data-zone-surface={tone['data-zone-surface']}
      onClick={() => onToggle(card.id)}
      aria-expanded={isOpen}
      aria-label={`${card.eyebrow}. ${card.line} Tap for the source.`}
    >
      <ZoneBentoCardHeader journeyId="home" label={card.eyebrow} />

      <span className={styles.face} aria-hidden={isOpen}>
        <h3 className="card-headline m-0 min-w-0" lang="en">
          {card.line}
        </h3>
        <span className={styles.statStack}>
          <span className="data-value data-stamp-metric">{card.figure}</span>
        </span>
      </span>

      <span className={styles.proofOuter} aria-hidden={!isOpen}>
        <span className={styles.proofInner}>
          <span className={styles.back}>{card.back}</span>
          <span className={styles.source}>source. {card.source}</span>
        </span>
      </span>

      <span className={styles.hint} aria-hidden="true">
        {isOpen ? 'close' : 'proof +'}
      </span>
    </button>
  )
}
