'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { hasInAppPrevious } from '@/lib/nav/inAppHistory'

/**
 * Back that remembers where you came from: browser history when the previous page was in-app
 * (which also restores its scroll position), otherwise the given parent page, e.g. when the page
 * was opened from a search result, a shared link or a new tab.
 */
export function useSmartBack(fallbackHref: string) {
  const router = useRouter()
  return useCallback(() => {
    if (hasInAppPrevious()) router.back()
    else router.push(fallbackHref)
  }, [router, fallbackHref])
}
