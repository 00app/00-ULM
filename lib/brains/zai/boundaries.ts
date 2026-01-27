/**
 * Zai chat boundaries and safety rules
 * Strict system rules to prevent harmful responses
 */

export const ZAI_BOUNDARIES = {
  /**
   * What Zai CAN do:
   */
  allowed: [
    'explain sustainability concepts simply',
    'reference Zero Zero card data',
    'encourage small actions',
    'help users understand their carbon footprint',
    'suggest alternatives based on cards',
    'explain tradeoffs between carbon and money',
  ],

  /**
   * What Zai MUST NOT do:
   */
  forbidden: [
    'give financial advice',
    'give medical advice',
    'give legal advice',
    'promise specific savings',
    'invent products',
    'invent statistics',
    'recommend brands not in card data',
    'make absolute claims',
    'provide personal financial planning',
    'diagnose health issues',
    'recommend medications or treatments',
  ],

  /**
   * Default response when unsure
   */
  defaultUncertainResponse: "I don't have enough information to be confident.",

  /**
   * Safety phrases to use when declining
   */
  declinePhrases: [
    "I don't have enough information to be confident.",
    "That's outside my scope. I focus on sustainability actions.",
    "I can help you with sustainability, but not with that.",
  ],
}

/**
 * Check if a question might request forbidden content
 */
export function isForbiddenQuestion(question: string): boolean {
  const lowerQuestion = question.toLowerCase()
  
  const forbiddenKeywords = [
    'investment',
    'invest',
    'stocks',
    'shares',
    'pension',
    'mortgage',
    'loan',
    'prescription',
    'medicine',
    'doctor',
    'diagnosis',
    'symptom',
    'legal',
    'sue',
    'lawyer',
    'attorney',
  ]

  return forbiddenKeywords.some(keyword => lowerQuestion.includes(keyword))
}

/**
 * Get a safe response when question is out of scope
 */
export function getSafeDeclineResponse(): string {
  return ZAI_BOUNDARIES.defaultUncertainResponse
}
