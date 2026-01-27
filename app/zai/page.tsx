'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '../context/AppContext'
import FloatingNav from '../components/FloatingNav'
import CircleCTA from '../components/CircleCTA'
import InputField from '../components/InputField'

export default function ZaiPage() {
  const router = useRouter()
  const { state } = useApp()
  const [question, setQuestion] = useState('')
  const [responses, setResponses] = useState<Array<{ question: string; answer: string }>>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleQuestionSubmit = async () => {
    if (!question.trim()) return
    if (isLoading) return

    setIsLoading(true)

    try {
      // Call Zai API endpoint with user context
      const response = await fetch('/api/zai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question.trim(),
          user_id: state.userId || null,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()
      
      setResponses(prev => [...prev, { question, answer: data.answer }])
      setQuestion('')
    } catch (error) {
      console.error('Error getting Zai response:', error)
      // Fallback to simple response
      setResponses(prev => [...prev, { 
        question, 
        answer: 'i\'m here to help you understand. what would you like to know?' 
      }])
      setQuestion('')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ice p-4 safe-bottom relative">
      <div className="max-w-2xl mx-auto">
        {/* Heading at top - same position and style as likes page */}
        <h1 className="mb-8 text-center animate-fade-up">ask zero.</h1>

        {/* Responses with bubbles */}
        <div className="mb-8 space-y-4" style={{ paddingBottom: '200px' }}>
          {responses.map((response, index) => (
            <div key={index} className="space-y-2">
              {/* Question (right aligned) */}
              <div className="text-right">
                <p className="text-body text-deep/80 question-text">{response.question}</p>
              </div>
              {/* Answer in bubble (left aligned) */}
              <div className="text-left">
                <div
                  style={{
                    display: 'inline-block',
                    background: 'var(--color-cool)',
                    borderRadius: 30,
                    padding: 15,
                    maxWidth: '80%',
                  }}
                >
                  <p className="text-body" style={{ margin: 0, color: 'var(--color-deep)', textTransform: 'none' }}>
                    {response.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input field - pinned above FloatingNav with padding */}
        <div
          style={{
            position: 'fixed',
            bottom: 100, /* Above FloatingNav (20px bottom + ~78px nav height + 2px gap) */
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <InputField
            value={question}
            placeholder="ask zero..."
            onChange={setQuestion}
            onAdvance={handleQuestionSubmit}
            type="text"
          />
        </div>

        <FloatingNav
          active="chat"
          onNavigate={(key) => {
            if (key === 'likes') router.push('/likes')
            if (key === 'zone') router.push('/zone')
            if (key === 'summary') router.push('/settings')
            if (key === 'chat') router.push('/zai')
          }}
        />
      </div>
    </div>
  )
}
