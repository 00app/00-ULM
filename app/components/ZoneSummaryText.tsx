'use client'

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { ZoneWelcomeCopy } from '@/lib/architecturalPulse'

/** Optional currency sign + digits (with , and . inside): "£2.9", "10.3", "1,200". */
const NUMBER_RE = /([£$€]?)(\d[\d,]*(?:\.\d+)?)/g

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function format(n: number, decimals: number, grouped: boolean): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouped })
}

/**
 * A number that counts up to its real value. It always ends on exactly `value`; the width is
 * reserved by an invisible copy of the final text, so nothing around it shifts while it counts;
 * screen readers get the final value only. Re-counts (from where it is) if the value changes.
 */
function AnimatedNumber({ value, delayMs }: { value: string; delayMs: number }) {
  const [shown, setShown] = useState(value)
  const shownRef = useRef(value)
  const first = useRef(true)
  const decimals = (value.split('.')[1] ?? '').length
  const grouped = value.includes(',')

  useEffect(() => {
    const target = Number.parseFloat(value.replace(/,/g, ''))
    if (!Number.isFinite(target) || reducedMotion()) {
      shownRef.current = value
      setShown(value)
      first.current = false
      return
    }
    const from = first.current ? 0 : Number.parseFloat(shownRef.current.replace(/,/g, '')) || 0
    const duration = first.current ? 900 : 600
    const delay = first.current ? delayMs : 0
    first.current = false
    let raf = 0
    let start = 0
    const tick = (t: number) => {
      if (!start) start = t
      const p = Math.min(1, Math.max(0, (t - start - delay) / duration))
      const eased = 1 - Math.pow(1 - p, 3)
      const text = p >= 1 ? value : format(from + (target - from) * eased, decimals, grouped)
      shownRef.current = text
      setShown(text)
      if (p < 1) raf = window.requestAnimationFrame(tick)
    }
    shownRef.current = format(from, decimals, grouped)
    setShown(shownRef.current)
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <span className="zs-num-wrap">
      <span className="zs-num zs-num-size" aria-hidden="true">
        {value}
      </span>
      <span className="zs-num" aria-hidden="true">
        {shown}
      </span>
      <span className="sr-only">{value}</span>
    </span>
  )
}

/** Splits a token into runs: currency + number (numerals face, counted up) and plain text. */
function renderToken(token: string, delayMs: number): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  NUMBER_RE.lastIndex = 0
  while ((m = NUMBER_RE.exec(token))) {
    if (m.index > last) out.push(token.slice(last, m.index))
    if (m[1]) out.push(<span key={`c${m.index}`} className="zs-num">{m[1]}</span>)
    out.push(<AnimatedNumber key={`n${m.index}`} value={m[2]} delayMs={delayMs} />)
    last = m.index + m[0].length
  }
  if (last < token.length) out.push(token.slice(last))
  return out
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

const WORD_STAGGER_MS = 55
const NUMBER_LEAD_MS = 280

/** Words rise in one by one (stagger continues across lines via `base`); numbers count up. */
function Words({ text, base }: { text: string; base: number }) {
  let w = 0
  return (
    <>
      {text.split(/(\s+)/).map((part, i) => {
        if (!part) return null
        if (/^\s+$/.test(part)) return <Fragment key={i}> </Fragment>
        const idx = w++
        return (
          <span key={i} className="zs-word" style={{ '--w': idx } as CSSProperties}>
            {renderToken(part, (base + idx) * WORD_STAGGER_MS + NUMBER_LEAD_MS)}
          </span>
        )
      })}
    </>
  )
}

/**
 * The Zone head: greeting, count, £ line, CO₂ line. Every line is the same size and weight
 * (see .zone-summary-line); only digits switch to the numerals face. A line with nothing to say
 * (a zero figure, or the empty SSR placeholder) is not rendered. Space for four lines is reserved
 * in CSS, so figures arriving later never push the page down.
 */
export function ZoneSummary({ welcome, figuresReady = true }: { welcome: ZoneWelcomeCopy; figuresReady?: boolean }) {
  const greeting = `${welcome.timeOfDayLine.replace(/\.$/, ',')} ${welcome.nameLine}`.trim()
  const money = welcome.localityLine.match(/^(£\S+)\s+(.*)$/)
  const lines: { key: string; text: string; figure?: string; rest?: string }[] = []
  if (greeting && welcome.nameLine) lines.push({ key: 'greeting', text: greeting })
  // The figure lines wait for the real totals (until then the page shows a tips-based estimate that
  // would visibly jump); the greeting never waits.
  if (figuresReady && welcome.foundCountLine) lines.push({ key: 'found', text: welcome.foundCountLine })
  if (figuresReady && welcome.localityLine) {
    lines.push(money ? { key: 'money', text: welcome.localityLine, figure: money[1], rest: money[2] } : { key: 'money', text: welcome.localityLine })
  }
  if (figuresReady && welcome.savingsMoneyLine) lines.push({ key: 'carbon', text: welcome.savingsMoneyLine })

  let base = 0
  return (
    <>
      {lines.map((line, i) => {
        const b = base
        base += countWords(line.text)
        return (
          <p
            key={line.key}
            className={`zone-summary-line m-0${i === 0 ? ' zone-summary-greeting' : ''}`}
            style={{ '--zs-base': b } as CSSProperties}
          >
            {line.figure ? (
              <>
                <span className="zone-summary-figure">
                  <Words text={line.figure} base={b} />
                </span>{' '}
                <Words text={line.rest ?? ''} base={b + 1} />
              </>
            ) : (
              <Words text={line.text} base={b} />
            )}
          </p>
        )
      })}
    </>
  )
}
