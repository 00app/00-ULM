'use client'

import type { ReactNode } from 'react'

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)])/gi

export type ZaiLinkTrackPayload = {
  url: string
  title?: string
  journey_key?: string
  source?: 'zai_chat'
}

async function trackZaiLinkClick(payload: ZaiLinkTrackPayload): Promise<void> {
  try {
    await fetch('/api/likes/track', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // non-blocking
  }
}

function linkNodes(text: string, onLink?: (url: string) => void): ReactNode[] {
  const parts = text.split(URL_RE)
  return parts.map((part, i) => {
    if (!/^https?:\/\//i.test(part)) return part
    const href = part.replace(/[),.]+$/, '')
    return (
      <a
        key={`${href}-${i}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="zai-chat-inline-link underline"
        onClick={() => onLink?.(href)}
      >
        {href}
      </a>
    )
  })
}

export function renderZaiChatProse(
  text: string,
  track?: Omit<ZaiLinkTrackPayload, 'url'>
): ReactNode {
  return linkNodes(text, (url) => {
    void trackZaiLinkClick({ url, ...track })
  })
}
