'use client'

import { useEffect, useState } from 'react'
import { bentoColsForViewportWidth } from '@/lib/zone/bentoPack'

/** Match groovy-zone-grid breakpoints (768 / 1024). */
export function useBentoGridCols(): number {
  const [cols, setCols] = useState(1)

  useEffect(() => {
    const update = () => setCols(bentoColsForViewportWidth(window.innerWidth))
    update()
    window.addEventListener('resize', update, { passive: true })
    return () => window.removeEventListener('resize', update)
  }, [])

  return cols
}
