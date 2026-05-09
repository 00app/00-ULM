'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ROUTES } from '@/lib/routes'
import type { PulseMetric } from '@/lib/adminPulse'

type PulsePayload = {
  timestamp?: string
  neon?: PulseMetric
  gemini?: PulseMetric
  firecrawl?: PulseMetric
  error?: string
}

function StatusWord({ metric }: { metric?: PulseMetric }) {
  const s = metric?.state ?? '—'
  const ok = s === 'online'
  const skip = s === 'skipped'
  return (
    <span
      className="card-headline zz-h3 m-0 uppercase"
      style={{
        color: ok ? 'var(--color-purple)' : skip ? 'var(--color-purple)' : '#c62828',
        opacity: skip ? 0.75 : 1,
      }}
    >
      {s}
    </span>
  )
}

function PulseCard({
  title,
  metric,
}: {
  title: string
  metric?: PulseMetric
}) {
  return (
    <div
      className="bento-card-groovy flex flex-col justify-between gap-4 border-0 text-left w-full min-h-[200px]"
      style={{
        backgroundColor: 'var(--color-yellow)',
        color: 'var(--color-purple)',
        borderRadius: 60,
        boxShadow: 'none',
      }}
    >
      <span className="card-top-label uppercase" style={{ color: 'var(--color-purple)' }}>
        {title}
      </span>
      <div className="flex flex-col gap-2">
        <StatusWord metric={metric} />
        {typeof metric?.latencyMs === 'number' ? (
          <span className="zz-body m-0 opacity-80" style={{ color: 'var(--color-purple)' }}>
            {metric.latencyMs} ms
          </span>
        ) : null}
        {metric?.detail ? (
          <span className="zz-body m-0 opacity-75 break-words" style={{ color: 'var(--color-purple)' }}>
            {metric.detail}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export default function AdminPulsePage() {
  const [data, setData] = useState<PulsePayload | null>(null)
  const [unauthorized, setUnauthorized] = useState(false)

  const fetchPulse = useCallback(() => {
    fetch('/api/admin/pulse', { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 401) {
          setUnauthorized(true)
          setData(null)
          return
        }
        setUnauthorized(false)
        const j = (await r.json()) as PulsePayload
        setData(j)
      })
      .catch(() => {
        setData({ error: 'request failed' })
      })
  }, [])

  useEffect(() => {
    fetchPulse()
    const interval = setInterval(fetchPulse, 10_000)
    return () => clearInterval(interval)
  }, [fetchPulse])

  return (
    <main
      className="relative min-h-screen w-full box-border px-[20px] lg:px-[40px] py-10"
      style={{ backgroundColor: 'var(--color-purple)' }}
    >
      <div className="w-full max-w-[min(1060px,100%)] mx-auto flex flex-col gap-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <h1
            className="card-headline zz-h2 m-0 uppercase tracking-tight"
            style={{ color: 'var(--color-yellow)', fontFamily: 'var(--font-marvin)', fontWeight: 700 }}
          >
            System pulse
          </h1>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <button
              type="button"
              onClick={() => fetchPulse()}
              className="rounded-full px-5 py-2 border-0 cursor-pointer uppercase font-bold text-sm"
              style={{
                fontFamily: 'var(--font-marvin)',
                backgroundColor: 'var(--color-yellow)',
                color: 'var(--color-purple)',
              }}
            >
              Refresh
            </button>
            <span className="zz-body m-0 opacity-70" style={{ color: 'var(--color-yellow)' }}>
              {data?.timestamp ? `Last beat: ${data.timestamp}` : '—'}
            </span>
          </div>
        </header>

        {unauthorized ? (
          <p className="zz-body-bold m-0" style={{ color: 'var(--color-yellow)' }}>
            Sign in (session cookie) or call this API with <code className="text-xs">Authorization: Bearer</code> using{' '}
            <code className="text-xs">CRON_SECRET</code> / gateway token — same as health diagnostics.
          </p>
        ) : null}

        {data?.error ? (
          <p className="zz-body-bold m-0" style={{ color: 'var(--color-yellow)' }}>
            {data.error}
          </p>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <PulseCard title="Neon database" metric={data?.neon} />
          <PulseCard title="Gemini AI" metric={data?.gemini} />
          <PulseCard title="Firecrawl" metric={data?.firecrawl} />
        </div>

        <Link
          href={ROUTES.ZONE}
          className="inline-flex items-center gap-2 no-underline uppercase font-bold zz-body-bold"
          style={{ color: 'var(--color-yellow)' }}
        >
          ← Back to zone
        </Link>
      </div>
    </main>
  )
}
