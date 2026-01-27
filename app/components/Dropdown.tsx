'use client'

import React, { useState } from 'react'

interface DropdownProps {
  options: string[]
  value?: string
  placeholder?: string
  onSelect?: (value: string) => void
  autoAdvance?: boolean
}

/**
 * Dropdown - For >9 options only
 * - Same size & typography as input
 * - Select = auto-advance
 * - No CTA arrow
 */
export default function Dropdown({ 
  options, 
  value,
  placeholder = 'select',
  onSelect,
  autoAdvance = true
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = (option: string) => {
    onSelect?.(option)
    setIsOpen(false)
    // Auto-advance handled by parent
  }

  return (
    <div style={{ position: 'relative', width: 350, height: 60 }}>
      <div style={{
        display: 'flex',
        width: 350,
        height: 60,
        padding: '0 20px',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: 30,
        background: value ? '#000AFF' : '#F8F8FE',
        color: value ? '#FDFDFF' : '#000AFF',
      }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: value ? '#FDFDFF' : '#000AFF',
            fontFamily: 'Roboto',
            fontSize: 40,
            lineHeight: '38px',
            letterSpacing: '-2px',
            fontWeight: 900,
            textTransform: 'lowercase',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            textAlign: 'left',
            padding: 0
          }}
        >
          <span>{value || placeholder}</span>
          <span>↓</span>
        </button>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 8,
            borderRadius: 30,
            background: '#F8F8FE',
            maxHeight: 300,
            overflowY: 'auto',
            zIndex: 1000,
            border: '1px solid #000AFF',
          }}
        >
          {options.map((option) => (
            <button
              key={option}
              onClick={() => handleSelect(option)}
              style={{
                width: '100%',
                padding: '16px 20px',
                border: 'none',
                background: 'transparent',
                color: '#000AFF',
                fontFamily: 'Roboto',
                fontSize: 40,
                lineHeight: '38px',
                letterSpacing: '-2px',
                fontWeight: 900,
                textTransform: 'lowercase',
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#000AFF'
                e.currentTarget.style.color = '#FDFDFF'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#000AFF'
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
