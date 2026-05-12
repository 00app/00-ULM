'use client'

interface ProgressBarProps {
  progress: number
}

export default function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <div
      className="progress-bar"
      style={{
        width: '100%',
        height: 4,
        background: 'var(--color-purple)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <div
        className="progress-bar-fill"
        style={{
          width: `${Math.min(100, Math.max(0, progress * 100))}%`,
          height: '100%',
          background: 'var(--color-purple)',
          borderRadius: 2,
          transition: 'width 150ms ease',
        }}
      />
    </div>
  )
}
