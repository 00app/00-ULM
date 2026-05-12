'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

export type PulseExpandedDiagnostics = {
  providerName: string
  sourceUrl: string
}

type Ctx = {
  value: PulseExpandedDiagnostics | null
  setValue: (v: PulseExpandedDiagnostics | null) => void
}

const PulseExpandedDiagnosticsContext = createContext<Ctx | null>(null)

export function PulseExpandedDiagnosticsProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<PulseExpandedDiagnostics | null>(null)
  const setValueStable = useCallback((v: PulseExpandedDiagnostics | null) => {
    setValue(v)
  }, [])
  const ctx = useMemo(
    () => ({ value, setValue: setValueStable }),
    [value, setValueStable]
  )
  return (
    <PulseExpandedDiagnosticsContext.Provider value={ctx}>
      {children}
    </PulseExpandedDiagnosticsContext.Provider>
  )
}

export function usePulseExpandedDiagnostics(): PulseExpandedDiagnostics | null {
  return useContext(PulseExpandedDiagnosticsContext)?.value ?? null
}

export function usePulseExpandedDiagnosticsSetter(): (v: PulseExpandedDiagnostics | null) => void {
  const c = useContext(PulseExpandedDiagnosticsContext)
  return c?.setValue ?? (() => {})
}
