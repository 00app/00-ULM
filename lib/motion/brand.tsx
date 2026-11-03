'use client'

/**
 * Zero Zero brand motion (docs/BRAND-LANGUAGE.md). Shared by the front door and every new
 * Workspace surface. Framer Motion. Wrap a page in <MotionConfig reducedMotion="user"> so
 * transforms switch off for people who ask for less motion; CountUp then shows its final value.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  animate,
  motion,
  useInView,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'framer-motion'

/** The one brand ease. */
export const EASE = [0.22, 1, 0.36, 1] as const

/** Lines that rise out of a mask on mount, staggered. Pass the mask classes for your scope. */
export function RevealLines({
  lines,
  className,
  delay = 0,
  maskClassName = 'zz-brand-mask',
  innerClassName = 'zz-brand-mask__inner',
}: {
  lines: ReactNode[]
  className?: string
  delay?: number
  maskClassName?: string
  innerClassName?: string
}) {
  return (
    <span className={className}>
      {lines.map((line, i) => (
        <span key={i} className={maskClassName}>
          <motion.span
            className={innerClassName}
            initial={{ y: '105%' }}
            animate={{ y: '0%' }}
            transition={{ duration: 1, delay: delay + i * 0.11, ease: EASE }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </span>
  )
}

/**
 * Masked reveal for a line that scrolls into view. Triggers on the visible mask, not the clipped
 * inner line: IntersectionObserver honours clipping, so the inner line would never fire.
 */
export function RevealOnView({
  children,
  maskClassName = 'zz-brand-mask',
  innerClassName = 'zz-brand-mask__inner',
}: {
  children: ReactNode
  maskClassName?: string
  innerClassName?: string
}) {
  return (
    <motion.span
      className={maskClassName}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
    >
      <motion.span
        className={innerClassName}
        variants={{ hidden: { y: '105%' }, show: { y: '0%' } }}
        transition={{ duration: 1, ease: EASE }}
      >
        {children}
      </motion.span>
    </motion.span>
  )
}

/** Fades and lifts a block into view once. */
export function Rise({
  children,
  delay = 0,
  className,
  as = 'div',
}: {
  children: ReactNode
  delay?: number
  className?: string
  as?: 'div' | 'li' | 'section'
}) {
  const Tag = (as === 'li' ? motion.li : as === 'section' ? motion.section : motion.div) as typeof motion.div
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-12% 0px' }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </Tag>
  )
}

/** Counts from 0 to value once in view. The final value is always in aria-label. */
export function CountUp({
  value,
  prefix = '',
  suffix = '',
  className,
  duration = 1.6,
}: {
  value: number
  prefix?: string
  suffix?: string
  className?: string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-15% 0px' })
  const reduce = useReducedMotion()
  const [n, setN] = useState(reduce ? value : 0)

  useEffect(() => {
    if (!inView) return
    if (reduce) {
      setN(value)
      return
    }
    const controls = animate(0, value, { duration, ease: EASE, onUpdate: (v) => setN(Math.round(v)) })
    return () => controls.stop()
  }, [inView, reduce, value, duration])

  return (
    <span ref={ref} className={className} aria-label={`${prefix}${value.toLocaleString('en-GB')}${suffix}`}>
      <span aria-hidden="true">
        {prefix}
        {n.toLocaleString('en-GB')}
        {suffix}
      </span>
    </span>
  )
}

/** One word of a scroll-linked statement: ink fills in as the paragraph passes. */
export function InkWord({
  word,
  progress,
  range,
  className,
}: {
  word: string
  progress: MotionValue<number>
  range: [number, number]
  className?: string
}) {
  const opacity = useTransform(progress, range, [0.18, 1])
  return (
    <motion.span style={{ opacity }} className={className}>
      {word}{' '}
    </motion.span>
  )
}
