'use client'

import { useEffect, useState } from 'react'
import { readSwitchRecords, SWITCH_RECORDS_EVENT, type SwitchRecords } from '@/lib/bank/switchTracker'

/** Live view of the stored switch records (re-reads on the tracker's change event). */
export function useSwitchRecords(): SwitchRecords {
  const [records, setRecords] = useState<SwitchRecords>({})
  useEffect(() => {
    const sync = () => setRecords(readSwitchRecords())
    sync()
    window.addEventListener(SWITCH_RECORDS_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(SWITCH_RECORDS_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return records
}
