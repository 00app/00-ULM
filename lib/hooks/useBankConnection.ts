'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BANK_CONNECTION_EVENT,
  DEFAULT_BANK_STATE,
  readBankState,
  snoozeUntil,
  writeBankState,
  type BankConnectionState,
} from '@/lib/bank/connectionState'
import { getBankProvider } from '@/lib/bank'
import {
  analyseTransactions,
  SAMPLE_OFFER_BOOK,
  type BankAnalysis,
  type OfferBook,
} from '@/lib/bank/analysis'

/** Bank connection state + actions. Connecting runs the sample provider (no live calls exist yet). */
export function useBankConnection() {
  const [state, setState] = useState<BankConnectionState>(DEFAULT_BANK_STATE)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const sync = () => setState(readBankState())
    sync()
    setHydrated(true)
    window.addEventListener(BANK_CONNECTION_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(BANK_CONNECTION_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const connect = useCallback(async () => {
    const provider = getBankProvider('sample')
    await provider.connect()
    writeBankState({ status: 'sample', snoozedUntil: null })
  }, [])

  const disconnect = useCallback(async () => {
    const provider = getBankProvider(readBankState().status === 'live' ? 'live' : 'sample')
    try {
      await provider.disconnect()
    } catch {
      /* live stub throws; local state is cleared regardless */
    }
    writeBankState({ status: 'none', snoozedUntil: null })
  }, [])

  const snooze = useCallback(() => {
    writeBankState({ status: 'none', snoozedUntil: snoozeUntil() })
  }, [])

  return { state, hydrated, connect, disconnect, snooze }
}

/**
 * Analysis of the connected account. Sample connections run the real pipeline over the sample
 * provider's data against the sample offer book; "live" has no provider yet, so it yields null.
 */
export function useBankAnalysis(status: BankConnectionState['status'], offers: OfferBook = SAMPLE_OFFER_BOOK) {
  const [analysis, setAnalysis] = useState<BankAnalysis | null>(null)
  useEffect(() => {
    if (status !== 'sample') {
      setAnalysis(null)
      return
    }
    let cancelled = false
    void (async () => {
      const provider = getBankProvider('sample')
      await provider.connect()
      const now = new Date()
      const from = new Date(now.getTime() - 365 * 86_400_000)
      const txs = await provider.getTransactions({ from, to: now })
      if (!cancelled) setAnalysis(analyseTransactions(txs, { offers, source: 'sample' }))
    })().catch(() => {
      if (!cancelled) setAnalysis(null)
    })
    return () => {
      cancelled = true
    }
  }, [status, offers])
  return analysis
}
