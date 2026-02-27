'use client'

import Link from 'next/link'

interface ZButtonProps {
  href?: string
  onClick?: () => void
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  type?: 'button' | 'submit'
  disabled?: boolean
}

export default function ZButton({
  href,
  onClick,
  children,
  variant = 'primary',
  type = 'button',
  disabled,
}: ZButtonProps) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 32px',
    borderRadius: 40,
    border: 'none',
    fontFamily: 'Roboto',
    fontSize: 14,
    fontWeight: 900,
    letterSpacing: 0,
    textTransform: 'uppercase' as const,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }
  const primary = {
    ...base,
    background: 'var(--color-cool)',
    color: 'var(--color-blue)',
  }
  const secondary = {
    ...base,
    background: 'var(--color-blue)',
    color: 'var(--color-ice)',
  }
  const style = variant === 'primary' ? primary : secondary

  if (href) {
    return (
      <Link href={href} style={style}>
        {children}
      </Link>
    )
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={style}>
      {children}
    </button>
  )
}
