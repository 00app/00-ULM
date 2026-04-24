'use client'

import { useSyncExternalStore, type ReactNode } from 'react'

const emptySubscribe = () => () => {}

/**
 * Renders children only on the client. Prevents hydration mismatches when
 * children use window, localStorage, or other browser-only APIs.
 * useSyncExternalStore flips to children in the same hydration cycle as React
 * finishes (before paint in many cases), unlike useEffect which runs after paint.
 */
export default function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)
  if (!mounted) return <>{fallback}</>
  return <>{children}</>
}
