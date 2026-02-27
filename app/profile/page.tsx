'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'
import ProgressBar from '../components/ProgressBar'
import InputField from '../components/InputField'
import AnswerCircle from '../components/AnswerCircle'

const springBounce = { type: 'spring' as const, stiffness: 380, damping: 26 }

const questions = [
  { id: 'name', question: "what's your name?", type: 'input' as const },
  { id: 'postcode', question: 'your postcode?', type: 'input' as const },
  { id: 'livingSituation', question: 'who do you live with?', type: 'text-options' as const, options: ['ALONE', 'COUPLE', 'FAMILY', 'SHARED'] },
  { id: 'homeType', question: 'your home?', type: 'text-options' as const, options: ['FLAT', 'HOUSE'] },
  { id: 'transport', question: 'how do you get around?', type: 'text-options' as const, options: ['WALK', 'BIKE', 'PUBLIC', 'CAR', 'MIX'] },
  { id: 'age', question: 'how old are you?', type: 'text-options' as const, options: ['JUNIOR', 'MID', 'RETIRED'] },
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
      const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Save profile and persistence keys required by Spec
      localStorage.setItem('userId', userId)
      localStorage.setItem('profile_name', answers.name || '')
      localStorage.setItem('profile_postcode', answers.postcode || '')
      localStorage.setItem('profile_household', answers.livingSituation || '')
      localStorage.setItem('profile_home_type', answers.homeType || '')
      localStorage.setItem('profile_transport', answers.transport || '')
      localStorage.setItem('profile_age', answers.age || '')
      
      // Update AppContext
      setProfile({
        id: userId,
        name: answers.name || '',
        postcode: answers.postcode || '',
        livingSituation: answers.livingSituation || '',
        homeType: answers.homeType || '',
        transport: answers.transport || '',
        age: (answers.age as 'JUNIOR' | 'MID' | 'RETIRED') || undefined,
      })
      setUserId(userId)
      
      router.push('/profile/summary')
    }
  }

  const handleTextOptionSelect = (option: string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: option }))
    setTimeout(() => {
      if (currentStep < questions.length - 1) {
        setCurrentStep((prev) => prev + 1)
      } else {
        handleInputAdvance()
      }
    }, 200)
  }

  return (
    <div className="zz-profile-page">
      <motion.div
        className="progress-bar-wrap"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <ProgressBar progress={(currentStep + 1) / questions.length} />
      </motion.div>
      <div className="zz-profile-label-wrap">
        <span className="text-label">profile</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          className="question-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={springBounce}
        >
          <h2 className="question-text">{currentQuestion.question}</h2>
        </motion.div>
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          className="answer-container"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ ...springBounce, delay: 0.06 }}
        >
          {currentQuestion.type === 'input' ? (
            <InputField
              value={currentAnswer}
              placeholder={currentQuestion.id === 'name' ? 'name' : 'enter'}
              onChange={handleInputChange}
              onAdvance={handleInputAdvance}
            />
          ) : (
            <div className="answer-options-wrap">
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
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
