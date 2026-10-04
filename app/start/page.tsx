'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import EntryShell from '@/app/components/EntryShell'
import InputField from '@/app/components/InputField'
import ProfileAnswerBtn from '@/app/components/ui/ProfileAnswerBtn'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import { familyControlDelaySec } from '@/lib/motion-family'
import { checkUkPostcode } from '@/lib/geocode/ukPostcode'
import { PROFILE_STORAGE_KEYS } from '@/lib/profile/onboardingComplete'
import { persistUnifiedUserProfileMemory } from '@/lib/unifiedProfileMemory'
import { trackFunnelEvent } from '@/lib/analytics/trackFunnelEvent'
import { ROUTES } from '@/lib/routes'

/** Entry step 2: one postcode field, UK format validated, nothing else asked. */
export default function StartPostcodePage() {
  const router = useRouter()
  const reduceMotion = useHydrationSafeReducedMotion()
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PROFILE_STORAGE_KEYS.postcode)
      if (stored) setValue(stored)
    } catch {
      /* storage blocked */
    }
    router.prefetch(ROUTES.START_RESULT)
  }, [router])

  const check = checkUkPostcode(value)
  const showError = touched && value.trim().length > 0 && !check.valid

  const submit = () => {
    setTouched(true)
    if (!check.valid) return
    try {
      localStorage.setItem(PROFILE_STORAGE_KEYS.postcode, check.normalized)
      persistUnifiedUserProfileMemory()
    } catch {
      /* storage blocked: the result page also takes the postcode from the URL */
    }
    trackFunnelEvent('cta_click', { page: ROUTES.START, cta_label: 'postcode_continue' })
    router.push(`${ROUTES.START_RESULT}?postcode=${encodeURIComponent(check.normalized)}`)
  }

  return (
    <EntryShell>
      <h1
        className="zz-h2 text-display m-0 text-center"
        style={{ maxWidth: 'min(92vw, 48rem)', color: 'var(--color-blue)' }}
      >
        Where do you live?
      </h1>
      <div className="profile-step-controls profile-step-controls--input">
        <InputField
          value={value}
          onChange={(v) => setValue(v)}
          onAdvance={submit}
          placeholder="postcode"
          name="postal-code"
          autoComplete="postal-code"
          autoFocus
        />
        {showError ? (
          <p className="entry-postcode-error" role="alert" data-testid="postcode-error">
            That doesn&apos;t look like a UK postcode.
          </p>
        ) : null}
        <div className="profile-step-controls profile-step-controls--options">
          <ProfileAnswerBtn
            reduceMotion={reduceMotion}
            optionIndex={0}
            delaySeconds={familyControlDelaySec(0)}
            className=""
            disabled={!check.valid}
            onClick={submit}
            aria-label="Continue"
          >
            <span className="profile-answer-btn__text zz-h4">CONTINUE</span>
          </ProfileAnswerBtn>
        </div>
      </div>
      <button type="button" className="entry-text-link" onClick={() => router.back()}>
        Back
      </button>
    </EntryShell>
  )
}
