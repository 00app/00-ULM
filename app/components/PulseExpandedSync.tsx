'use client'

import { useEffect } from 'react'
import { usePulseExpandedDiagnosticsSetter } from '@/app/context/PulseExpandedDiagnosticsContext'

/**
 * Registers the active expanded Solo Focus card’s provenance for {@link PulseWidget}.
 * Mount inside expanded overlays only; unmount clears the global pulse source.
 */
export function PulseExpandedSync({
  providerName,
  sourceUrl,
}: {
  providerName: string
  sourceUrl: string
}) {
  const setPulse = usePulseExpandedDiagnosticsSetter()
  useEffect(() => {
    setPulse({ providerName: providerName.trim() || '—', sourceUrl: sourceUrl.trim() || '' })
    return () => setPulse(null)
  }, [providerName, sourceUrl, setPulse])
  return null
}
