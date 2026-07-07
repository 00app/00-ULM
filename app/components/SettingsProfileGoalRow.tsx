'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import ProfileAnswerBtn from '@/app/components/ui/ProfileAnswerBtn'
import SettingsBentoCard from '@/app/components/SettingsBentoCard'
import {
  PROFILE_GOAL_CHOICES,
  type ProfileGoalValue,
} from '@/lib/profile/goalWeighting'
import {
  readEffectiveProfileGoal,
  persistProfileGoal,
} from '@/lib/profile/profileGoalPreference'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import { markCardVisited } from '@/lib/zone/visitedCards'

type SettingsProfileGoalRowProps = {
  onChange?: () => void
}

/** Settings control — same three focus circles as intro; rewrites `profile_goal` + session sync. */
export default function SettingsProfileGoalRow({ onChange }: SettingsProfileGoalRowProps) {
  const reduceMotion = useHydrationSafeReducedMotion()
  const [goal, setGoal] = useState<ProfileGoalValue>('balanced')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setGoal(readEffectiveProfileGoal())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const sync = () => setGoal(readEffectiveProfileGoal())
    window.addEventListener('profile-goal-changed', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('profile-goal-changed', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const handleSelect = (value: ProfileGoalValue) => {
    markCardVisited('settings-focus-goal')
    if (value === goal) return
    persistProfileGoal(value)
    setGoal(value)
    onChange?.()
  }

  if (!mounted) return null

  const activeLabel = PROFILE_GOAL_CHOICES.find((c) => c.value === goal)?.label ?? 'BOTH'

  return (
    <SettingsBentoCard label="Your focus" headline={activeLabel} cardId="settings-focus-goal">
      <div
        className="profile-step-controls profile-step-controls--options settings-focus-controls"
        role="group"
        aria-label="Change your focus"
      >
        {PROFILE_GOAL_CHOICES.map((choice, optionIndex) => (
          <ProfileAnswerBtn
            key={choice.value}
            reduceMotion={reduceMotion}
            optionIndex={optionIndex}
            delaySeconds={0.05 * optionIndex}
            className={goal === choice.value ? 'selected' : ''}
            style={
              choice.theme
                ? ({ '--local-theme': choice.theme } as CSSProperties & { '--local-theme'?: string })
                : undefined
            }
            onClick={() => handleSelect(choice.value)}
            aria-label={choice.ariaLabel}
          >
            <span className="profile-answer-btn__text zz-h4 intro-goal-btn__text">
              {choice.displayLabel}
            </span>
          </ProfileAnswerBtn>
        ))}
      </div>
    </SettingsBentoCard>
  )
}
