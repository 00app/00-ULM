'use client'

import { useEffect } from 'react'

/** Hides Zone wall under Solo Focus; pairs with `body.has-solo-focus` rules in globals.css */
export function useSoloFocusHudBodyClass(active: boolean) {
  useEffect(() => {
    if (!active) return
    document.body.classList.add('has-solo-focus')
    return () => {
      document.body.classList.remove('has-solo-focus')
    }
  }, [active])
}
