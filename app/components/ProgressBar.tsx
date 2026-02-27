'use client'

interface ProgressBarProps {
  progress: number
}

export default function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <div
      style={{
        width: '100%',
        height: 4,
        background: 'var(--color-cool)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, progress * 100))}%`,
          height: '100%',
          background: 'var(--color-blue)',
          borderRadius: 2,
          transition: 'width 150ms ease',
        }}
      />
    </div>
  )
}
