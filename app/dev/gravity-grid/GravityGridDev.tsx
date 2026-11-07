'use client'

import { useEffect, useRef, useState } from 'react'
import GravityGrid, { type GravityGridHandle } from '@/app/components/brand/GravityGrid'
import { FIELD } from '@/lib/brand/field'
import type { GravityGridStats } from '@/lib/brand/gravity-grid'

const BLOCKS = [
  {
    title: 'Your bills, checked every month.',
    body: 'Drag across this text. The trace under a block marked data-field-quiet is capped, so the copy stays readable.',
  },
  {
    title: '£312 a year',
    body: 'Typical saving on energy and broadband for a two-bed flat in Leeds. Source: Ofgem price cap, October 2026.',
  },
  {
    title: 'You approve every step.',
    body: 'Tap anywhere for a small well. Hover with a mouse for a wide, weak one. Scroll to see the edge lag.',
  },
]

/** Phone-friendly playground: full-screen grid, quiet text blocks, a few toggles and live stats. */
export default function GravityGridDev() {
  const gridRef = useRef<GravityGridHandle>(null)
  const [enabled, setEnabled] = useState(true)
  const [bounce, setBounce] = useState<boolean>(FIELD.spring.bounce)
  const [stats, setStats] = useState<GravityGridStats | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setStats(gridRef.current?.getStats() ?? null), 250)
    return () => window.clearInterval(id)
  }, [])

  return (
    <main className="zz-brand" style={{ minHeight: '220vh', padding: '24px 20px 120px', color: 'var(--zzb-ink)' }}>
      <GravityGrid ref={gridRef} enabled={enabled} bounce={bounce} />

      <div
        style={{
          position: 'sticky',
          top: 12,
          zIndex: 2,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          padding: 10,
          borderRadius: 16,
          background: 'var(--zzb-navy)',
          color: 'var(--zzb-white)',
          fontSize: 13,
          maxWidth: 560,
        }}
      >
        <DevButton onClick={() => setEnabled((v) => !v)}>{enabled ? 'Disable' : 'Enable'}</DevButton>
        <DevButton onClick={() => setBounce((v) => !v)}>Bounce: {bounce ? 'on' : 'off'}</DevButton>
        <DevButton onClick={() => gridRef.current?.clearTrace()}>Clear trace</DevButton>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {stats
            ? `${stats.dots} dots · ${stats.active} active · ${stats.frameMs.toFixed(2)}ms · ${
                stats.awake ? 'awake' : 'asleep'
              }${stats.rects ? ' · rects' : ''}`
            : '…'}
        </span>
      </div>

      <div style={{ display: 'grid', gap: '40vh', marginTop: '18vh', maxWidth: 560 }}>
        {BLOCKS.map((b) => (
          <section key={b.title} data-field-quiet>
            <h2 style={{ fontSize: 'clamp(32px, 7vw, 56px)', lineHeight: 1.05, margin: '0 0 12px' }}>{b.title}</h2>
            <p style={{ fontSize: 17, lineHeight: 1.55, margin: 0, color: 'var(--zzb-muted)' }}>{b.body}</p>
          </section>
        ))}
        <div
          style={{
            background: 'var(--zzb-navy)',
            color: 'var(--zzb-white)',
            borderRadius: 24,
            padding: 32,
          }}
        >
          A navy card keeps its fill: the field is hidden behind it.
        </div>
      </div>
    </main>
  )
}

function DevButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 36,
        padding: '0 14px',
        borderRadius: 999,
        border: 0,
        background: 'var(--zzb-white)',
        color: 'var(--zzb-navy)',
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}
