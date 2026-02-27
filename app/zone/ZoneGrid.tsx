'use client'

import React, { useState } from 'react'
import ZoneCard, { type ZoneCardItem } from '@/app/components/ZoneCard'

export interface ZoneGridCard {
  id: string
  item: ZoneCardItem
  sizeRole: 'hero' | 'square' | 'small'
}

const GRID_GAP = 10
const GRID_WIDTH = 280

interface ZoneGridProps {
  cards: ZoneGridCard[]
  onSave?: (id: string) => void
  isLiked?: (id: string) => boolean
}

export default function ZoneGrid({ cards, onSave, isLiked }: ZoneGridProps) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null)

  if (cards.length === 0) return null

  const hero = cards[0]
  const squares = cards.slice(1, 3)
  const smallChunks: ZoneGridCard[][] = []
  for (let i = 3; i < cards.length; i += 3) {
    smallChunks.push(cards.slice(i, i + 3))
  }

  const handleTap = (id: string) => {
    setActiveCardId((prev) => (prev === id ? null : id))
  }

  return (
    <div
      className="tips-zone-grid"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: GRID_GAP,
        width: '100%',
        maxWidth: GRID_WIDTH + 40,
        margin: '0 auto',
        padding: '0 20px',
      }}
    >
      {/* Row 1: Hero — full width, expands vertically */}
      <div style={{ width: GRID_WIDTH, flexShrink: 0 }}>
        <ZoneCard
          item={hero.item}
          sizeRole="hero"
          index={0}
          isExpanded={activeCardId === hero.id}
          onTap={() => handleTap(hero.id)}
          onClose={() => setActiveCardId(null)}
          onSave={onSave}
          isLiked={isLiked?.(hero.id)}
        />
      </div>

      {/* Row 2: Squares — flex wrap; when one expands to 100%, the other shifts down */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: GRID_GAP,
          width: GRID_WIDTH,
        }}
      >
        {squares.map((card, i) => (
          <ZoneCard
            key={card.id}
            item={card.item}
            sizeRole="square"
            index={1 + i}
            isExpanded={activeCardId === card.id}
            onTap={() => handleTap(card.id)}
            onClose={() => setActiveCardId(null)}
            onSave={onSave}
            isLiked={isLiked?.(card.id)}
          />
        ))}
      </div>

      {/* Rows 3–5: Small cards — 3-column; when one expands to 100%, others wrap */}
      {smallChunks.map((chunk, chunkIndex) => (
        <div
          key={chunkIndex}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: GRID_GAP,
            width: GRID_WIDTH,
          }}
        >
          {chunk.map((card, i) => (
            <ZoneCard
              key={card.id}
              item={card.item}
              sizeRole="small"
              index={3 + chunkIndex * 3 + i}
              isExpanded={activeCardId === card.id}
              onTap={() => handleTap(card.id)}
              onClose={() => setActiveCardId(null)}
              onSave={onSave}
              isLiked={isLiked?.(card.id)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
