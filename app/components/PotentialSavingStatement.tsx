'use client'

import React from 'react'

interface PotentialSavingStatementProps {
  money?: number
  carbon?: number
}

/**
 * PotentialSavingStatement - Locked dimensions and styling
 * - 370px width, 60px border radius
 * - BLUE background (#000AFF)
 * - Mobile: 50px/48px, Desktop: 90px/81px
 * - Left-aligned text, hard line breaks
 */
import { formatCarbon } from '@/lib/format'

export default function PotentialSavingStatement({ money = 0, carbon = 0 }: PotentialSavingStatementProps) {
  const moneyValue = money > 0 ? `£${money}` : 'n/a'
  const carbonValue = carbon > 0 ? formatCarbon(carbon) : 'n/a'

  return (
    <div className="potential-saving-statement">
      <h3 className="potential-saving-text">you could save {moneyValue}.</h3>
      <h3 className="potential-saving-text">{carbonValue}</h3>
      <h3 className="potential-saving-text">co₂e this year alone.</h3>
    </div>
  )
}
