'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Card from '../components/Card'
import Sheet from '../components/Sheet'
import FloatingNav from '../components/FloatingNav'
import CircleCTA from '../components/CircleCTA'

interface LikedCard {
  id: string
  title: string
  subtitle?: string
  type: 'carbon' | 'money' | 'mixed'
  data?: {
    money?: string
    carbon?: string
  }
}

export default function LikesPage() {
  const router = useRouter()
  const [likedCards, setLikedCards] = useState<LikedCard[]>([])
  const [selectedCard, setSelectedCard] = useState<LikedCard | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmCardId, setConfirmCardId] = useState<string | null>(null)

  useEffect(() => {
    // Load liked cards from localStorage
    const stored = localStorage.getItem('likedCards')
    if (stored) {
      try {
        setLikedCards(JSON.parse(stored))
      } catch (e) {
        // Ignore
      }
    }
  }, [])

  const handleCardClick = (card: LikedCard) => {
    setSelectedCard(card)
    setSheetOpen(true)
  }

  const handleSheetClose = () => {
    setSheetOpen(false)
    setSelectedCard(null)
  }

  const handleUnlikeClick = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    setConfirmCardId(cardId)
  }

  const handleConfirmYes = () => {
    if (confirmCardId) {
      const updated = likedCards.filter(c => c.id !== confirmCardId)
      setLikedCards(updated)
      localStorage.setItem('likedCards', JSON.stringify(updated))
      setConfirmCardId(null)
      // Close sheet if the unliked card is selected
      if (selectedCard?.id === confirmCardId) {
        setSheetOpen(false)
        setSelectedCard(null)
      }
    }
  }

  const handleConfirmNo = () => {
    setConfirmCardId(null)
  }

  const getPodColor = (type: 'carbon' | 'money' | 'mixed') => {
    switch (type) {
      case 'carbon':
        return 'var(--color-blue)'
      case 'money':
        return 'var(--color-deep)'
      case 'mixed':
        return 'var(--color-ice)'
    }
  }

  return (
    <div className="min-h-screen bg-ice p-4 safe-bottom">
      <div className="max-w-2xl mx-auto">
        <h1 className="mb-8 text-center animate-fade-up">your likes.</h1>

        {likedCards.length === 0 ? (
          <div className="question-screen">
            <h3 style={{ textAlign: 'center', color: 'var(--color-deep)' }}>no likes yet.</h3>
          </div>
        ) : (
          <div className="space-y-4 mb-12">
            {likedCards.map((card) => (
              <div key={card.id} style={{ position: 'relative' }}>
                <Card
                  variant="card-liked"
                  onClick={() => handleCardClick(card)}
                  title={card.title}
                  subtitle={card.subtitle}
                  data={card.data}
                />
                
                {/* Bottom Center: LEARN, LIKE, SWITCH buttons - positioned below all text */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: 10,
                    zIndex: 10,
                    pointerEvents: 'auto',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* LEARN button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // Open source URL if available
                    }}
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
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background var(--duration-fast) var(--easing-zero), color var(--duration-fast) var(--easing-zero)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-blue)'
                      e.currentTarget.style.color = 'var(--color-ice)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--color-cool)'
                      e.currentTarget.style.color = 'var(--color-blue)'
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.background = 'var(--color-deep)'
                      e.currentTarget.style.color = 'var(--color-ice)'
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.background = 'var(--color-blue)'
                      e.currentTarget.style.color = 'var(--color-ice)'
                    }}
                  >
                    learn
                  </button>

                  {/* LIKE button */}
                  <button
                    onClick={(e) => handleUnlikeClick(card.id, e)}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      border: 'none',
                      background: 'var(--color-pink)',
                      color: 'var(--color-ice)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'background var(--duration-fast) var(--easing-zero), color var(--duration-fast) var(--easing-zero)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-blue)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--color-pink)'
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.background = 'var(--color-deep)'
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.background = 'var(--color-pink)'
                    }}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>

                  {/* SWITCH button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCardClick(card)
                    }}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      border: 'none',
                      background: 'var(--color-blue)',
                      color: 'var(--color-ice)',
                      fontFamily: 'Roboto',
                      fontSize: 10,
                      lineHeight: '14px',
                      fontWeight: 900,
                      letterSpacing: 0,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background var(--duration-fast) var(--easing-zero), color var(--duration-fast) var(--easing-zero)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-deep)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--color-blue)'
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.background = 'var(--color-deep)'
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.background = 'var(--color-blue)'
                    }}
                  >
                    switch
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <FloatingNav
          active="likes"
          onNavigate={(key) => {
            if (key === 'likes') router.push('/likes')
            if (key === 'zone') router.push('/zone')
            if (key === 'summary') router.push('/settings')
            if (key === 'chat') router.push('/zai')
          }}
        />
      </div>

      {/* Sheet */}
      {selectedCard && (
        <Sheet
          isOpen={sheetOpen}
          onClose={handleSheetClose}
          onSwitch={() => {
            // Primary action: navigate to product/offer/checkout
            handleSheetClose()
          }}
          data={{
            id: selectedCard.id,
            title: selectedCard.title,
            subtitle: selectedCard.subtitle,
            data: selectedCard.data,
            source: undefined, // Can be added later from card data
          }}
        />
      )}

      {/* Confirmation Popup */}
      {confirmCardId && (
        <>
          {/* Backdrop */}
          <div
            onClick={handleConfirmNo}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(20, 18, 104, 0.4)',
              zIndex: 130,
              animation: 'fadeUp 120ms var(--easing-zero) forwards',
            }}
          />
          
          {/* Popup */}
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'var(--color-ice)',
              borderRadius: 60,
              padding: '40px 30px',
              maxWidth: '90%',
              width: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 30,
              zIndex: 140,
              animation: 'fadeUp 150ms var(--easing-zero) forwards',
            }}
          >
            {/* Text */}
            <h3
              style={{
                textAlign: 'center',
                margin: 0,
                color: 'var(--color-deep)',
              }}
            >
              are you sure.
            </h3>

            {/* Buttons */}
            <div
              style={{
                display: 'flex',
                gap: 20,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* No button */}
              <CircleCTA
                variant="text"
                text="no"
                onClick={handleConfirmNo}
              />
              
              {/* Yes button */}
              <CircleCTA
                variant="text"
                text="yes"
                onClick={handleConfirmYes}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
