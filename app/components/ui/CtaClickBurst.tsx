'use client'

import { useEffect } from 'react'

const CTA_SELECTOR = [
  '.profile-answer-btn',
  '.circle-btn',
  '.solo-focus-action-btn',
  '.answer-circle-100',
  '.funky-answer-circle',
  '.zz-button-circle',
  '.action-circle-80',
  '.rock-mobile-send-btn',
  '.settings-circle-cta',
].join(',')

/**
 * Click drama for every circular CTA: adds `.zz-cta-burst` (see globals.css) on pointerdown so
 * the glow ring + spring-back plays even on a quick tap, which a bare :active state would cut
 * short. One delegated listener for the whole app — no per-button wiring.
 */
export default function CtaClickBurst() {
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target.closest<HTMLElement>(CTA_SELECTOR) : null
      if (!target || (target as HTMLButtonElement).disabled) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      target.classList.remove('zz-cta-burst')
      // Force a reflow so re-clicking mid-animation restarts it.
      void target.offsetWidth
      target.classList.add('zz-cta-burst')
      target.addEventListener('animationend', () => target.classList.remove('zz-cta-burst'), {
        once: true,
      })
      if (navigator.vibrate) navigator.vibrate(10)
    }
    document.addEventListener('pointerdown', onPointerDown, { passive: true })
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])
  return null
}
