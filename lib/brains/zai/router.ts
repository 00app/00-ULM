/**
 * Zai question router
 * Routes questions to appropriate handlers by topic
 */

export type ZaiTopic = 'carbon' | 'money' | 'travel' | 'food' | 'general'

/**
 * Detect topic from question
 */
export function routeQuestion(question: string): ZaiTopic {
  const lowerQuestion = question.toLowerCase()

  // Carbon/travel topics
  if (
    lowerQuestion.includes('carbon') ||
    lowerQuestion.includes('emission') ||
    lowerQuestion.includes('co2') ||
    lowerQuestion.includes('travel') ||
    lowerQuestion.includes('transport') ||
    lowerQuestion.includes('car') ||
    lowerQuestion.includes('train') ||
    lowerQuestion.includes('bus')
  ) {
    if (lowerQuestion.includes('travel') || lowerQuestion.includes('transport') || lowerQuestion.includes('car')) {
      return 'travel'
    }
    return 'carbon'
  }

  // Money topics
  if (
    lowerQuestion.includes('money') ||
    lowerQuestion.includes('save') ||
    lowerQuestion.includes('cost') ||
    lowerQuestion.includes('price') ||
    lowerQuestion.includes('cheap') ||
    lowerQuestion.includes('expensive')
  ) {
    return 'money'
  }

  // Food topics
  if (
    lowerQuestion.includes('food') ||
    lowerQuestion.includes('eat') ||
    lowerQuestion.includes('diet') ||
    lowerQuestion.includes('meat') ||
    lowerQuestion.includes('vegetarian') ||
    lowerQuestion.includes('vegan')
  ) {
    return 'food'
  }

  // Default to general
  return 'general'
}

/**
 * Get topic-specific response guidance
 */
export function getTopicGuidance(topic: ZaiTopic): string {
  const guidance: Record<ZaiTopic, string> = {
    carbon: 'Focus on carbon footprint reduction. Reference card data about emissions.',
    money: 'Focus on cost savings that align with sustainability. Reference money-saving cards.',
    travel: 'Focus on transport alternatives. Reference travel-related cards.',
    food: 'Focus on dietary choices and their impact. Reference food-related cards.',
    general: 'Provide general sustainability guidance. Reference relevant cards when applicable.',
  }

  return guidance[topic]
}
