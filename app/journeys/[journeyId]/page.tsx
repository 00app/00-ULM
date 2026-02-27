'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useApp } from '../../context/AppContext'
import { JOURNEYS, JOURNEY_ORDER, getNextJourney, type JourneyId } from '@/lib/journeys'
import { getJourneyImpact } from '@/lib/brains/buildUserImpact'
import ProgressBar from '../../components/ProgressBar'
import AnswerCircle from '../../components/AnswerCircle'
import InputField from '../../components/InputField'
import Dropdown from '../../components/Dropdown'
import CircleCTA from '../../components/CircleCTA'

export default function JourneyPage() {
  const router = useRouter()
  const params = useParams()
  const { state } = useApp()
  const journeyId = params.journeyId as JourneyId
  
  const journey = JOURNEYS[journeyId]
  
  const [showIntro, setShowIntro] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [showSummary, setShowSummary] = useState(false)
  const [summaryText, setSummaryText] = useState('')
  const [completedJourneys, setCompletedJourneys] = useState<JourneyId[]>([])
  const [summaryLineIndex, setSummaryLineIndex] = useState(0)
  const [showSummaryCTAs, setShowSummaryCTAs] = useState(false)
  const [numericRepeatUsedAtStep, setNumericRepeatUsedAtStep] = useState<number | null>(null)

  useEffect(() => {
    if (!journey) {
      router.push('/fork')
      return
    }

    // Load existing answers from localStorage; de-dupe: prefill from profile where applicable
    const storedAnswers = localStorage.getItem(`journey_${journeyId}_answers`)
    const profileTransport = typeof localStorage !== 'undefined' ? localStorage.getItem('profile_transport') : null
    const profileHomeType = typeof localStorage !== 'undefined' ? localStorage.getItem('profile_home_type') : null
    let initial: Record<string, string> = {}
    if (storedAnswers) {
      try {
        initial = JSON.parse(storedAnswers)
      } catch (e) {
        // Ignore
      }
    }
    if (journeyId === 'travel' && profileTransport && !initial.primary_transport) {
      initial.primary_transport = profileTransport
    }
    if (journeyId === 'home' && profileHomeType) {
      if (!initial.home_type) initial.home_type = profileHomeType
    }
    if (Object.keys(initial).length > 0) setAnswers(initial)

    // Load completed journeys (local state for now)
    const stored = localStorage.getItem('completedJourneys')
    if (stored) {
      try {
        setCompletedJourneys(JSON.parse(stored))
      } catch (e) {
        // Ignore
      }
    }
  }, [journey, journeyId, router])

  // Summary animation effect - Match intro speed (0.4s per line, hard cuts)
  // MUST be before conditional returns to follow React hooks rules
  useEffect(() => {
    if (showSummary) {
      const lines = summaryText.split('\n')
      if (summaryLineIndex < lines.length) {
        const timer = setTimeout(() => {
          if (summaryLineIndex < lines.length - 1) {
            setSummaryLineIndex(prev => prev + 1)
          } else {
            // Final line complete - show CTAs
            setShowSummaryCTAs(true)
          }
        }, 400) // 0.4s per line (matches intro speed)
        return () => clearTimeout(timer)
      }
    } else {
      // Reset when summary is hidden
      setSummaryLineIndex(0)
      setShowSummaryCTAs(false)
    }
  }, [showSummary, summaryLineIndex, summaryText])

  if (!journey) {
    return null
  }

  // No redundancy: if profile_transport exists (e.g. from Neon), skip first Travel question
  const profileTransport = typeof window !== 'undefined' ? localStorage.getItem('profile_transport') : null
  const displayQuestions =
    journeyId === 'travel' && profileTransport
      ? journey.questions.filter((q) => q.id !== 'primary_transport')
      : journey.questions

  const currentQuestion = displayQuestions[currentStep]
  const currentAnswer = answers[currentQuestion?.id] || ''
  const canProceed = currentAnswer.trim() !== ''
  const isRepeatedNumeric = numericRepeatUsedAtStep === currentStep
  const displayLabel = (isRepeatedNumeric && currentQuestion?.repeatLabel)
    ? currentQuestion.repeatLabel
    : (currentQuestion?.label ?? '')

  // Progressive: include current answer for live impact (number input)
  const answersForLive = currentQuestion?.type === 'number' && currentAnswer.trim()
    ? { ...answers, [currentQuestion.id]: currentAnswer }
    : answers
  const liveImpact = Object.keys(answersForLive).length > 0
    ? getJourneyImpact(journeyId, answersForLive)
    : null

  function isNumericImplausible(qId: string, value: string): boolean {
    const v = value.trim()
    if (v === '' || v === '0') return true
    const n = Number(v)
    if (isNaN(n) || n < 0) return true
    if (qId === 'monthly_cost') return n < 10
    if (qId === 'distance_amount') return false // 0/empty already handled
    if (qId === 'monthly_spend') return n < 5
    return false
  }

  const handleIntroContinue = () => {
    setShowIntro(false)
  }

  const handleOptionSelect = (option: string) => {
    const answersSoFar = { ...answers, [currentQuestion.id]: option }
    setAnswers(answersSoFar)
    const storageKey = `journey_${journey.id}_answers`
    localStorage.setItem(storageKey, JSON.stringify(answersSoFar))
    window.dispatchEvent(new Event('journey-answers-updated'))

    setTimeout(() => {
      if (currentStep < displayQuestions.length - 1) {
        setCurrentStep((prev) => prev + 1)
      } else {
        showJourneySummary(answersSoFar)
      }
    }, 200)
  }

  const handleTextChange = (value: string) => {
    const answersSoFar = { ...answers, [currentQuestion.id]: value }
    setAnswers(answersSoFar)
    const storageKey = `journey_${journey.id}_answers`
    localStorage.setItem(storageKey, JSON.stringify(answersSoFar))
    window.dispatchEvent(new Event('journey-answers-updated'))
  }

  const handleTextAdvance = () => {
    if (!canProceed) return
    if (currentQuestion.type === 'number') {
      const implausible = isNumericImplausible(currentQuestion.id, currentAnswer)
      const alreadyRepeated = numericRepeatUsedAtStep === currentStep
      if (implausible && !alreadyRepeated) {
        setNumericRepeatUsedAtStep(currentStep)
        const updated = { ...answers, [currentQuestion.id]: '' }
        setAnswers(updated)
        const sk = `journey_${journey.id}_answers`
        localStorage.setItem(sk, JSON.stringify(updated))
        window.dispatchEvent(new Event('journey-answers-updated'))
        return
      }
    }
    if (currentStep < displayQuestions.length - 1) {
      setNumericRepeatUsedAtStep(null)
      setCurrentStep((prev) => prev + 1)
    } else {
      setNumericRepeatUsedAtStep(null)
      showJourneySummary()
    }
  }

  const handleDropdownSelect = (value: string) => {
    const answersSoFar = { ...answers, [currentQuestion.id]: value }
    setAnswers(answersSoFar)
    const storageKey = `journey_${journey.id}_answers`
    localStorage.setItem(storageKey, JSON.stringify(answersSoFar))
    window.dispatchEvent(new Event('journey-answers-updated'))

    setTimeout(() => {
      if (currentStep < displayQuestions.length - 1) {
        setCurrentStep((prev) => prev + 1)
      } else {
        showJourneySummary(answersSoFar)
      }
    }, 200)
  }

  const showJourneySummary = (answersOverride?: Record<string, string>) => {
    const latest = answersOverride ?? answers
    const storageKey = `journey_${journey.id}_answers`
    localStorage.setItem(storageKey, JSON.stringify(latest))
    window.dispatchEvent(new Event('journey-answers-updated'))

    const impact = getJourneyImpact(journeyId, latest)
    const summaryLines = [
      'you could save',
      `£${Math.round(impact.moneyGbp)} a year`,
      'and cut',
      `${impact.carbonKg} kg CO₂ / year`,
    ]
    setSummaryText(summaryLines.join('\n'))

    const updated = [...completedJourneys, journeyId]
    setCompletedJourneys(updated)
    localStorage.setItem('completedJourneys', JSON.stringify(updated))

    setSummaryLineIndex(0)
    setShowSummaryCTAs(false)
    setShowSummary(true)
  }

  const handleContinue = () => {
    // Find next incomplete journey
    const nextJourney = getNextJourney(journeyId, completedJourneys)
    
    if (nextJourney) {
      router.push(`/journeys/${nextJourney}`)
    } else {
      // All journeys complete - go to Zone
      router.push('/zone')
    }
  }

  const handleGoToZone = () => {
    router.push('/zone') // Zone route
  }

  // Intro screen
  if (showIntro) {
    return (
      <div className="question-screen">
        <div className="flex flex-col items-center gap-12 w-full max-w-md px-4">
          <h1 className="text-center animate-fade-up">
            let's understand your {journey.name}
          </h1>
          <CircleCTA onClick={handleIntroContinue} variant="arrow" />
        </div>
      </div>
    )
  }

  // Summary screen
  if (showSummary) {
    const lines = summaryText.split('\n')
    const nextJourney = getNextJourney(journeyId, completedJourneys)

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'var(--color-ice)',
        position: 'relative'
      }}>
        {/* Summary text container - 385×172 */}
        <div style={{
          display: 'flex',
          width: 385,
          height: 172,
          flexDirection: 'column',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {lines.map((line, index) => (
            <div
              key={index}
              className="intro-font-size"
              style={{
                fontFamily: 'Roboto',
                fontWeight: 900,
                letterSpacing: '-2px',
                textTransform: 'lowercase',
                color: '#000AFF',
                textAlign: 'center',
                opacity: index === summaryLineIndex ? 1 : 0,
                transition: 'none', // Hard cuts only, no fade transitions
                position: index === summaryLineIndex ? 'relative' : 'absolute',
                visibility: index === summaryLineIndex ? 'visible' : 'hidden'
              }}
            >
              {line}
            </div>
          ))}
        </div>

        {/* Cards would appear here later - for now just CTAs */}
        {showSummaryCTAs && (
          <div style={{
            position: 'absolute',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 20,
            justifyContent: 'center'
          }}>
            {nextJourney ? (
              <>
                <CircleCTA onClick={handleContinue} variant="arrow" />
                <CircleCTA onClick={handleGoToZone} variant="text" text="zone" />
              </>
            ) : (
              <CircleCTA onClick={handleGoToZone} variant="text" text="zone" />
            )}
          </div>
        )}
      </div>
    )
  }

  // Question screen
  const isTextOptions = currentQuestion.type === 'options' && currentQuestion.options && currentQuestion.options.length <= 9
  const isDropdown = currentQuestion.type === 'options' && currentQuestion.options && currentQuestion.options.length > 9
  const isNumber = currentQuestion.type === 'number'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'var(--color-ice)',
      position: 'relative',
      padding: '0 20px',
      paddingBottom: '120px' // Spec: safe-bottom spacing for FloatingNav
    }}>
      {/* 1. Progress Bar - Fixed at top */}
      <div style={{ position: 'absolute', top: 3, left: 0, right: 0, padding: '0 20px' }}>
        <ProgressBar progress={(currentStep + 1) / displayQuestions.length} />
      </div>

      {/* 2. Category Badge */}
      <div style={{ marginTop: '40px' }}>
        <span className="text-label">{journey.name.toLowerCase()}</span>
      </div>

      {/* 3. Question container — fixed height prevents jumping when question length changes */}
      <div
        className="question-container"
        style={{
          marginTop: '110px',
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          maxWidth: 640,
          width: '100%',
        }}
      >
        <h2 className="question-text">
          {displayLabel}
        </h2>
      </div>

      {/* 4. Answers Container — exactly 40px below hero question (S Update clean-up) */}
      {isTextOptions && (
        <div
          className="answer-container"
          style={{
            marginTop: 40,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignContent: 'center', // Centers grid vertically if flex-1 provides extra height
          gap: '20px', // Equal vertical and horizontal spacing
          maxWidth: 360,
          flex: 1 
        }}>
          {currentQuestion.options?.map((option) => (
            <AnswerCircle
              key={option}
              text={option}
              selected={currentAnswer === option}
              onClick={() => handleOptionSelect(option)}
              autoAdvance={true}
              twoLine={currentQuestion.id === 'electricity_provider' || currentQuestion.id === 'gas_provider'}
            />
          ))}
        </div>
      )}

      {/* Dropdown variant — consistent spacing */}
      {isDropdown && (
        <div
          className="answer-container"
          style={{
            marginTop: 40,
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Dropdown
            options={currentQuestion.options || []}
            value={currentAnswer}
            placeholder="select"
            onSelect={handleDropdownSelect}
            autoAdvance={true}
          />
        </div>
      )}

      {/* Number input variant — consistent spacing */}
      {isNumber && (
        <div
          className="answer-container"
          style={{
            marginTop: 40,
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <InputField
            value={currentAnswer}
            placeholder={
              currentQuestion.id === 'monthly_cost' || currentQuestion.id === 'monthly_spend'
                ? 'amount'
                : currentQuestion.id === 'distance_amount'
                  ? 'miles'
                  : 'amount'
            }
            onChange={handleTextChange}
            onAdvance={handleTextAdvance}
            type="number"
          />
        </div>
      )}
    </div>
  )
}
