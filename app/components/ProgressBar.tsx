'use client'

import React from 'react'

interface ProgressBarProps {
  progress: number // 0 to 1
}

/**
 * ProgressBar - For question screens
 * - Simple progress indicator
 * - BLUE fill
 * - ICE background
 */
export default function ProgressBar({ progress }: ProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(1, progress))

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 400,
        height: 4,
        background: 'var(--color-ice)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${clampedProgress * 100}%`,
          height: '100%',
          background: 'var(--color-blue)',
          transition: `width ${160}ms var(--easing-zero)`,
        }}
      />
    </div>
  )
}
