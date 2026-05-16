'use client'

import { motion } from 'framer-motion'
import { Logo } from '@/app/components/Logo'
import {
  ZONE_ENGINE_HYDRATION_LABELS,
  type ZoneEngineStatus,
} from '@/lib/zone/engineHydration'

export function ZeroGateShutter({
  show = true,
  engineStatus = 'idle',
}: {
  show?: boolean
  engineStatus?: ZoneEngineStatus
}) {
  const phaseLabel =
    engineStatus !== 'idle' ? ZONE_ENGINE_HYDRATION_LABELS[engineStatus] : null

  return (
    <>
      {show ? (
        <motion.div
          key="zz-route-gate"
          className="zz-route-gate-shutter"
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 2 }}
          transition={{ duration: 0.12, ease: 'linear' }}
          aria-live="polite"
          aria-busy
          aria-label={phaseLabel ?? 'Zero Zero gate'}
        >
          {phaseLabel ? (
            <h2 className="zone-engine-hydration-status m-0 text-center">{phaseLabel}</h2>
          ) : (
            <motion.div
              animate={{ opacity: [1, 0.72, 1] }}
              transition={{ duration: 0.36, repeat: Infinity, ease: 'linear' }}
            >
              <Logo width={132} className="zz-gate-logo" />
            </motion.div>
          )}
        </motion.div>
      ) : null}
    </>
  )
}
