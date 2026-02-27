'use client'

import { useState } from 'react'

interface DropdownProps {
  options: string[]
  value: string
  placeholder: string
  onSelect: (value: string) => void
  autoAdvance?: boolean
}

export default function Dropdown({
  options,
  value,
  placeholder,
  onSelect,
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '16px 20px',
          borderRadius: 40,
          border: 'none',
          background: 'var(--color-cool)',
          color: value ? 'var(--color-deep)' : 'var(--color-deep)',
          fontFamily: 'Roboto',
          fontSize: 14,
          fontWeight: 900,
          textTransform: 'uppercase',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        {value || placeholder}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 8,
            background: 'var(--color-ice)',
            borderRadius: 20,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            maxHeight: 280,
            overflowY: 'auto',
            zIndex: 10,
          }}
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onSelect(opt)
                setOpen(false)
              }}
              style={{
                width: '100%',
                padding: '12px 20px',
                border: 'none',
                background: value === opt ? 'var(--color-cool)' : 'transparent',
                color: 'var(--color-deep)',
                fontFamily: 'Roboto',
                fontSize: 12,
                fontWeight: 900,
                textTransform: 'uppercase',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              {opt.replace('_', ' ')}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
