'use client'

import { useState } from 'react'
import { useApp } from '../context/AppContext'
import InputField from './InputField'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { setUserId } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSignup = async (eTrim: string, passwordValue: string) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: eTrim, password: passwordValue }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Sign up failed')
      return null
    }
    return data.user_id
  }

  const handleLogin = async (eTrim: string, passwordValue: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: eTrim, password: passwordValue }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Log in failed')
      return null
    }
    return data.user_id
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const eTrim = email.trim().toLowerCase()
    if (!eTrim || !password) return

    setLoading(true)
    try {
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: eTrim, password }),
      })
      const loginData = await loginRes.json().catch(() => ({}))
      if (loginRes.ok && loginData.user_id) {
        localStorage.setItem('userId', loginData.user_id)
        localStorage.setItem('user_id', loginData.user_id)
        localStorage.setItem('userEmail', email)
        setUserId(loginData.user_id)
        setEmail('')
        setPassword('')
        onClose()
        return
      }

      const signupRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: eTrim, password }),
      })
      const signupData = await signupRes.json().catch(() => ({}))
      if (signupRes.ok && signupData.user_id) {
        localStorage.setItem('userId', signupData.user_id)
        localStorage.setItem('user_id', signupData.user_id)
        localStorage.setItem('userEmail', email)
        setUserId(signupData.user_id)
        setEmail('')
        setPassword('')
        onClose()
        return
      }

      setError(loginData.error || signupData.error || 'Wrong email or password')
    } finally {
      setLoading(false)
    }
  }

  const ctaLabel = loading ? '...' : 'log in'

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

          <button
            type="submit"
            disabled={loading}
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
              cursor: loading ? 'wait' : 'pointer',
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
