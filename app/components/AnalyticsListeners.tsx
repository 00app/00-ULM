'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { trackFunnelEvent } from '@/lib/analytics/trackFunnelEvent'

function normalizeAppPath(p: string | null): string {
  const raw = (p ?? '').trim()
  if (!raw || raw === '/') return '/'
  return raw.replace(/\/+$/, '') || '/'
}

function resolveLinkKind(href: string): 'internal' | 'external' | null {
  const trimmed = href.trim()
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) {
    return null
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed)
      if (url.origin === window.location.origin) return 'internal'
      return 'external'
    } catch {
      return 'external'
    }
  }
  if (trimmed.startsWith('/')) return 'internal'
  return null
}

/** Route + outbound link telemetry — mounted once in GlobalAppShell. */
export default function AnalyticsListeners() {
  const pathname = usePathname()
  const path = normalizeAppPath(pathname)
  const lastPageViewRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastPageViewRef.current === path) return
    lastPageViewRef.current = path
    trackFunnelEvent('page_view', { page: path })
  }, [path])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a[href]')
      if (!anchor) return
      if (anchor.closest('.solo-focus-handoff-btn, [data-analytics-tracked="cta"]')) return

      const href = anchor.getAttribute('href')?.trim()
      if (!href) return
      const linkKind = resolveLinkKind(href)
      if (!linkKind) return

      trackFunnelEvent('link_click', {
        page: path,
        target_url: href,
        link_kind: linkKind,
      })
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [path])

  return null
}
