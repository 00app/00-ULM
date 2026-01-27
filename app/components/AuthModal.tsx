'use client'

import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import InputField from './InputField'

const AUTH_MOCK_KEY = 'auth_mock'

function getAuthMock(): Record<string, string> {
  try {
    const raw = localStorage.getItem(AUTH_MOCK_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function setAuthMock(obj: Record<string, string>) {
  localStorage.setItem(AUTH_MOCK_KEY, JSON.stringify(obj))
}

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { setUserId } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const userExists = useMemo(() => {
    if (!email?.trim()) return false
    const mock = getAuthMock()
    return email.trim().toLowerCase() in mock
  }, [email])

  const ctaLabel = userExists ? 'log in' : 'sign up'

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const eTrim = email.trim().toLowerCase()
    const mock = getAuthMock()

    if (!eTrim || !password) return

    if (!(eTrim in mock)) {
      // New user → sign up silently
      mock[eTrim] = password
      setAuthMock(mock)
      const userId = `user_${eTrim.replace(/[^a-z0-9]/g, '_')}_${Date.now()}`
      localStorage.setItem('userId', userId)
      localStorage.setItem('user_id', userId)
      localStorage.setItem('userEmail', email)
      setUserId(userId)
      setEmail('')
      setPassword('')
      onClose()
      return
    }

    if (mock[eTrim] !== password) {
      setError('wrong password')
      return
    }

    // Existing user, correct password → log in
    const userId = `user_${eTrim.replace(/[^a-z0-9]/g, '_')}_${Date.now()}`
    localStorage.setItem('userId', userId)
    localStorage.setItem('user_id', userId)
    localStorage.setItem('userEmail', email)
    setUserId(userId)
    setEmail('')
    setPassword('')
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="auth-modal"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 400,
          backgroundColor: 'var(--color-ice)',
          borderRadius: 60,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close — chevron top right, no text */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: 40,
            height: 40,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="close"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-deep)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 15L12 9L6 15" />
          </svg>
        </button>

        {/* H4 — get more free tips (centred, one line, blue) */}
        <h4
          style={{
            fontFamily: 'Roboto',
            fontSize: 24,
            fontWeight: 900,
            letterSpacing: '-2px',
            color: 'var(--color-blue)',
            textAlign: 'center',
            margin: 0,
            marginTop: 8,
          }}
        >
          get more free tips
        </h4>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 4 }}
        >
          <InputField
            value={email}
            onChange={(v) => {
              setEmail(v)
              setError('')
            }}
            placeholder="email"
            type="email"
            width="100%"
            className="input-field"
          />
          <InputField
            value={password}
            onChange={(v) => {
              setPassword(v)
              setError('')
            }}
            placeholder="password"
            type="password"
            width="100%"
            className="input-field"
          />

          {error && (
            <p
              style={{
                fontFamily: 'Roboto',
                fontSize: 14,
                fontWeight: 400,
                letterSpacing: 0,
                color: 'var(--color-deep)',
                margin: 0,
                textAlign: 'center',
              }}
            >
              {error}
            </p>
          )}

          {/* Single CTA — 80×80 circle, .zz-button, COOL / BLUE hover / DEEP active */}
          <button
            type="submit"
            className="zz-button"
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              border: 'none',
              background: 'var(--color-cool)',
              color: 'var(--color-blue)',
              fontFamily: 'Roboto',
              fontSize: 10,
              lineHeight: '14px',
              fontWeight: 900,
              letterSpacing: 0,
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              alignSelf: 'center',
            }}
          >
            {ctaLabel}
          </button>
        </form>
      </div>
    </div>
  )
}
