'use client'

/**
 * Zero Zero Funky v1.4 — 4. Zai (Chat) & Agent Elements
 * Rules: 60px groovy bubble radius. Input bar: strict 10px margin above FloatingNav.
 */

/** Vertical spacing between ZaiInputBar and FloatingNav when chat is above nav. */
export const ZAI_INPUT_MARGIN_ABOVE_NAV_PX = 10

export interface ZaiChatBubbleProps {
  message: string
  role: 'user' | 'zai'
  className?: string
}

/**
 * Chat bubble — 60px radius, Roboto body scale (matches `.zz-body`).
 */
export function ZaiChatBubble({ message, role, className = '' }: ZaiChatBubbleProps) {
  const isUser = role === 'user'
  return (
    <div
      className={`rounded-[60px] max-w-[85%] ${isUser ? 'ml-0 mr-auto' : 'mr-0 ml-auto'} ${className}`}
      style={{
        background: isUser ? 'var(--color-purple)' : 'var(--color-pink)',
        color: 'var(--color-yellow)',
        boxShadow: 'none',
        textShadow: 'none',
        fontFamily: 'var(--font-roboto), sans-serif',
        fontWeight: 800,
        fontSize: 'var(--zz-body-size)',
        lineHeight: 'var(--zz-lh-body)',
        padding: 'var(--padding-bento)',
      }}
    >
      {message}
    </div>
  )
}

export interface ZaiInputBarProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * Zero Zero Funky v1.4 — Pill input for Zai. 9999px radius.
 * When chat sits above FloatingNav: use marginBottom: ZAI_INPUT_MARGIN_ABOVE_NAV_PX (10px) on wrapper,
 * or paddingBottom: navHeight + ZAI_INPUT_MARGIN_ABOVE_NAV_PX on the scroll container.
 */
export function ZaiInputBar({
  value,
  onChange,
  onSubmit,
  placeholder = 'Ask zero...',
  disabled = false,
  className = '',
}: ZaiInputBarProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.()
      }}
      className={className}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-[9999px] border-0 py-4 px-5 outline-none focus:ring-0"
        style={{
          background: 'var(--color-purple)',
          color: 'var(--color-purple)',
          boxShadow: 'none',
          fontFamily: 'var(--font-roboto), sans-serif',
          fontSize: 'var(--zz-body-size)',
          fontWeight: 800,
        }}
      />
    </form>
  )
}
