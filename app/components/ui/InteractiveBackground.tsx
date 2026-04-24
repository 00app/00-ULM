'use client'

import { useEffect } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

/** Fixed liquid mesh + grain; sits at z-index stack from `globals.css` (env −10, grain −5). */
export default function InteractiveBackground() {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const yellowX = useSpring(mouseX, { stiffness: 50, damping: 20 })
  const yellowY = useSpring(mouseY, { stiffness: 50, damping: 20 })
  const pinkX = useSpring(mouseX, { stiffness: 30, damping: 35 })
  const pinkY = useSpring(mouseY, { stiffness: 30, damping: 35 })

  useEffect(() => {
    const toOffsets = (x: number, y: number) => {
      const w = window.innerWidth || 1
      const h = window.innerHeight || 1
      return {
        ox: x - w * 0.25,
        oy: y - h * 0.25,
      }
    }

    const onPointerMove = (x: number, y: number) => {
      const { ox, oy } = toOffsets(x, y)
      mouseX.set(ox)
      mouseY.set(oy)
    }

    const handleMouseMove = (e: MouseEvent) => onPointerMove(e.clientX, e.clientY)
    const handleTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      onPointerMove(t.clientX, t.clientY)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [mouseX, mouseY])

  return (
    <>
      {/* v1.9.6: global mesh — `.zz-background-env` is z-index −10 in globals.css */}
      <div className="zz-background-env" aria-hidden>
        <motion.div className="zz-blob zz-blob--yellow" style={{ x: yellowX, y: yellowY }} />
        <motion.div className="zz-blob zz-blob--pink" style={{ x: pinkX, y: pinkY }} />
        <motion.div
          className="zz-blob zz-blob--purple"
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        />
      </div>
      <div className="zz-grain-overlay" aria-hidden />
    </>
  )
}
