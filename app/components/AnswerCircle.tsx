'use client'

interface AnswerCircleProps {
  text: string
  selected: boolean
  onClick: () => void
  autoAdvance?: boolean
  twoLine?: boolean
}

export default function AnswerCircle({
  text,
  selected,
  onClick,
  twoLine,
}: AnswerCircleProps) {
  const displayText = twoLine ? text.replace('_', '\n') : text
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minWidth: 80,
        minHeight: 80,
        padding: '12px 20px',
        borderRadius: 40,
        border: 'none',
        background: selected ? 'var(--color-blue)' : 'var(--color-cool)',
        color: selected ? 'var(--color-ice)' : 'var(--color-blue)',
        fontFamily: 'Roboto',
        fontSize: twoLine ? 10 : 14,
        fontWeight: 900,
        letterSpacing: '0',
        textTransform: 'uppercase',
        whiteSpace: twoLine ? 'pre-line' : 'nowrap',
        lineHeight: 1.2,
        cursor: 'pointer',
        transition: 'background 120ms ease, color 120ms ease',
      }}
    >
      {displayText}
    </button>
  )
}
