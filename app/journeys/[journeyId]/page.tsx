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
import Card from '../../components/Card'

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

    // Load existing answers from localStorage
    const storedAnswers = localStorage.getItem(`journey_${journeyId}_answers`)
    if (storedAnswers) {
      try {
        setAnswers(JSON.parse(storedAnswers))
      } catch (e) {
        // Ignore
      }
    }

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

  const currentQuestion = journey.questions[currentStep]
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
      if (currentStep < journey.questions.length - 1) {
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
    if (currentStep < journey.questions.length - 1) {
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
      if (currentStep < journey.questions.length - 1) {
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
        background: '#FDFDFF',
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
      minHeight: '100vh',
      background: '#FDFDFF',
      position: 'relative'
    }}>
      {/* Progress bar at top (3px from top) */}
      <div style={{ position: 'absolute', top: 3, left: 0, right: 0, padding: '0 20px' }}>
        <ProgressBar progress={(currentStep + 1) / journey.questions.length} />
      </div>

      {/* Category badge at 40px */}
      <div style={{
        position: 'absolute',
        top: 40,
        left: '50%',
        transform: 'translateX(-50%)'
      }}>
        <span style={{
          fontFamily: 'Roboto',
          fontSize: 10,
          lineHeight: '14px',
          letterSpacing: '0.6px',
          fontWeight: 900,
          textTransform: 'uppercase',
          color: '#141268'
        }}>
          {journey.name.toLowerCase()}
        </span>
      </div>

      {/* Question at 110px (H2) */}
      <div style={{
        position: 'absolute',
        top: 110,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 640,
        padding: '0 20px',
        textAlign: 'center'
      }}>
        <h2 className="question-text" style={{
          fontFamily: 'Roboto',
          fontSize: 80,
          lineHeight: '76px',
          letterSpacing: '-2px',
          fontWeight: 900,
          textTransform: 'lowercase',
          color: '#000AFF'
        }}>
          {displayLabel}
        </h2>
      </div>

      {/* Answers */}
      {isTextOptions && (
        <div style={{
          position: 'absolute',
          top: 400,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 20,
          maxWidth: 360,
          margin: '0 auto'
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

      {isDropdown && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }}>
          <Dropdown
            options={currentQuestion.options || []}
            value={currentAnswer}
            placeholder="select"
            onSelect={handleDropdownSelect}
            autoAdvance={true}
          />
        </div>
      )}

      {isNumber && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }}>
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

      {/* Live summary — updates after every answered question */}
      {liveImpact && (
        <div style={{
          position: 'absolute',
          bottom: 48,
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          maxWidth: 320,
        }}>
          <p style={{
            fontFamily: 'Roboto',
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: 0,
            color: '#141268',
            margin: 0,
            marginBottom: 4,
          }}>
            Based on what you&apos;ve told us so far…
          </p>
          <p style={{
            fontFamily: 'Roboto',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '-1px',
            color: '#000AFF',
            margin: 0,
          }}>
            {liveImpact.carbonKg} kg CO₂ / year · £{Math.round(liveImpact.moneyGbp)} a year
          </p>
        </div>
      )}
    </div>
  )
}
