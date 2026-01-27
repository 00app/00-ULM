'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '../context/AppContext'
import ProgressBar from '../components/ProgressBar'
import InputField from '../components/InputField'
import AnswerCircle from '../components/AnswerCircle'

const questions = [
  {
    id: 'name',
    question: "what's your name?",
    type: 'input' as const, // InputField for name
  },
  {
    id: 'postcode',
    question: 'your postcode?',
    type: 'input' as const, // InputField for postcode
  },
  {
    id: 'livingSituation',
    question: 'who do you live with?',
    type: 'text-options' as const, // TextAnswerCTA
    options: ['ALONE', 'COUPLE', 'FAMILY', 'SHARED'],
  },
  {
    id: 'homeType',
    question: 'your home?',
    type: 'text-options' as const, // TextAnswerCTA
    options: ['FLAT', 'HOUSE'],
  },
  {
    id: 'transport',
    question: 'how do you get around?',
    type: 'text-options' as const, // TextAnswerCTA
    options: ['WALK', 'BIKE', 'PUBLIC', 'CAR', 'MIX'],
  },
]

export default function ProfilePage() {
  const router = useRouter()
  const { setProfile, setUserId } = useApp()
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const currentQuestion = questions[currentStep]
  const currentAnswer = answers[currentQuestion.id] || ''
  const canProceed = currentAnswer.trim() !== ''

  const handleInputChange = (value: string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }))
  }

  const handleInputAdvance = () => {
    if (canProceed && currentStep < questions.length - 1) {
      setCurrentStep((prev) => prev + 1)
    } else if (canProceed) {
      // Save profile locally and go to summary
      // Generate user_id on profile completion
      const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      setProfile({
        id: userId,
        name: answers.name || '',
        postcode: answers.postcode || '',
        livingSituation: answers.livingSituation || '',
        homeType: answers.homeType || '',
        transport: answers.transport || '',
      })
      setUserId(userId)
      // Persist user_id in localStorage
      localStorage.setItem('userId', userId)
      localStorage.setItem('user_id', userId)
      // Persist postcode for local offers
      if (answers.postcode) {
        localStorage.setItem('userPostcode', answers.postcode)
      }
      router.push('/profile/summary')
    }
  }

  const handleTextOptionSelect = (option: string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: option }))
    // Auto-advance after selection
    setTimeout(() => {
      if (currentStep < questions.length - 1) {
        setCurrentStep((prev) => prev + 1)
      } else {
        // Save profile locally and go to summary
        setProfile({
          id: 'local-user',
          name: answers.name || '',
          postcode: answers.postcode || '',
          livingSituation: answers.livingSituation || '',
          homeType: answers.homeType || '',
          transport: answers.transport || '',
        })
        setUserId('local-user')
        router.push('/profile/summary')
      }
    }, 200)
  }

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
        <ProgressBar progress={(currentStep + 1) / questions.length} />
      </div>

      {/* Category badge at 40px */}
      <div style={{
        position: 'absolute',
        top: 40,
        left: '50%',
        transform: 'translateX(-50%)'
      }}>
        <span className="text-label">
          profile
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
        <h2 className="question-text">
          {currentQuestion.question}
        </h2>
      </div>

      {/* Answers */}
      {currentQuestion.type === 'input' ? (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }}>
          <InputField
            value={currentAnswer}
            placeholder={currentQuestion.id === 'name' ? 'name' : currentQuestion.id === 'postcode' ? 'enter' : ''}
            onChange={handleInputChange}
            onAdvance={handleInputAdvance}
            type="text"
          />
        </div>
      ) : currentQuestion.type === 'text-options' ? (
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
              onClick={() => handleTextOptionSelect(option)}
              autoAdvance={true}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
