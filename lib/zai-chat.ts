/**
 * Zai Chat - Strict boundaries, contextual explainer
 * 
 * System prompt (stored exactly as specified)
 */
export const ZAI_SYSTEM_PROMPT = `You are Zai, a sustainability guide.

You:
- Explain why a recommendation exists
- Explain carbon and money tradeoffs
- Help users choose journeys
- Reference cards the user sees

You MUST NOT:
- Give medical advice
- Give legal advice
- Promise savings
- Invent products
- Invent statistics
- Recommend brands unless present in card data

If unsure, say:
"I don't have enough information to be confident."`

export interface ZaiContext {
  userProfile?: {
    name?: string
    home_type?: string
    transport_baseline?: string
  }
  /** From buildUserImpact (Single Source of Truth) — used to personalize answers */
  totals?: {
    totalMoney: number
    totalCarbon: number
  }
  completedJourneys?: string[]
  visibleCards?: Array<{
    title: string
    journey: string
  }>
  likedCards?: Array<{
    title: string
  }>
}

/**
 * Generate Zai response based on question and context
 * Simple rule-based system with strict boundaries
 */
export function generateZaiResponse(question: string, context: ZaiContext): string {
  const lowerQuestion = question.toLowerCase().trim()
  
  // Safety checks - if question contains forbidden topics, redirect
  if (lowerQuestion.includes('medical') || lowerQuestion.includes('health') || lowerQuestion.includes('illness')) {
    return 'i don\'t have enough information to be confident about health matters. please consult a healthcare professional.'
  }
  
  if (lowerQuestion.includes('legal') || lowerQuestion.includes('law') || lowerQuestion.includes('lawsuit')) {
    return 'i don\'t have enough information to be confident about legal matters. please consult a legal professional.'
  }
  
  // Carbon questions — reference user impact when available (Single Source of Truth)
  if (lowerQuestion.includes('carbon') || lowerQuestion.includes('emission') || lowerQuestion.includes('co2')) {
    if (context.totals != null && (context.totals.totalCarbon > 0 || context.totals.totalMoney > 0)) {
      const c = context.totals.totalCarbon
      const m = context.totals.totalMoney
      return `based on your data you\'re already cutting ${c} kg co₂ and saving £${m} a year. energy saving trust and defra data show small changes add up. every choice helps.`
    }
    if (context.visibleCards && context.visibleCards.length > 0) {
      const card = context.visibleCards[0]
      return `carbon impact is about understanding your choices. the card "${card.title}" shows one way to reduce emissions. every small change helps.`
    }
    return 'carbon impact is about understanding your choices. every small change helps.'
  }

  // Money questions — reference user impact when available
  if (lowerQuestion.includes('money') || lowerQuestion.includes('save') || lowerQuestion.includes('cost')) {
    if (context.totals != null && (context.totals.totalMoney > 0 || context.totals.totalCarbon > 0)) {
      const m = context.totals.totalMoney
      const c = context.totals.totalCarbon
      return `based on your data you\'re already saving £${m} a year and cutting ${c} kg co₂. uk sources like energy saving trust show where you can save more. no pressure.`
    }
    if (lowerQuestion.includes('save') || lowerQuestion.includes('saving')) {
      return 'saving money varies by situation. the cards show estimated savings, but your actual savings depend on your choices and circumstances. there\'s no pressure.'
    }
    return 'money considerations depend on your situation. every option has trade-offs.'
  }
  
  // Energy/Home questions
  if (lowerQuestion.includes('energy') || lowerQuestion.includes('home') || lowerQuestion.includes('electricity')) {
    if (context.userProfile?.home_type) {
      return `home energy use varies by ${context.userProfile.home_type}. small changes can add up over time. check your zone for specific recommendations.`
    }
    return 'home energy use varies. small changes can add up over time. check your zone for specific recommendations.'
  }
  
  // Travel questions
  if (lowerQuestion.includes('travel') || lowerQuestion.includes('transport') || lowerQuestion.includes('car') || lowerQuestion.includes('train')) {
    if (context.userProfile?.transport_baseline) {
      return `travel choices depend on your situation. your current transport (${context.userProfile.transport_baseline}) affects both cost and carbon. every option has trade-offs.`
    }
    return 'travel choices depend on your situation. every option has trade-offs.'
  }
  
  // Food questions
  if (lowerQuestion.includes('food') || lowerQuestion.includes('diet') || lowerQuestion.includes('meat') || lowerQuestion.includes('eating')) {
    return 'food choices are personal. there\'s no right or wrong way. what matters is understanding the impact of your choices.'
  }
  
  // Journey questions
  if (lowerQuestion.includes('journey') || lowerQuestion.includes('complete') || lowerQuestion.includes('start')) {
    if (context.completedJourneys && context.completedJourneys.length > 0) {
      return `you've completed ${context.completedJourneys.length} journey${context.completedJourneys.length > 1 ? 's' : ''}. check your zone for recommendations based on your progress.`
    }
    return 'journeys help you understand different areas of your impact. start with what interests you most.'
  }
  
  // Card/likes questions
  if (lowerQuestion.includes('card') || lowerQuestion.includes('like') || lowerQuestion.includes('recommend')) {
    if (context.likedCards && context.likedCards.length > 0) {
      return `you have ${context.likedCards.length} liked card${context.likedCards.length > 1 ? 's' : ''}. these are saved in your likes section. each card explains its carbon and money impact.`
    }
    if (context.visibleCards && context.visibleCards.length > 0) {
      return `your zone shows personalized recommendations. each card explains its carbon and money impact. tap a card to learn more.`
    }
    return 'cards show personalized recommendations based on your journey progress. each explains its carbon and money impact.'
  }
  
  // Uncertainty questions
  if (lowerQuestion.includes('uncertain') || lowerQuestion.includes('not sure') || lowerQuestion.includes('confused') || lowerQuestion.includes('don\'t know')) {
    return 'it\'s okay to be uncertain. take your time. there\'s no rush. start with small changes and see what works for you.'
  }
  
  // Help questions
  if (lowerQuestion.includes('help') || lowerQuestion.includes('what') || lowerQuestion.includes('how') || lowerQuestion.includes('explain')) {
    return 'i\'m here to explain and reassure. what would you like to understand better? ask about carbon, money, journeys, or your cards.'
  }
  
  // Default response
  return 'i\'m here to help you understand. what would you like to know? ask about carbon, money, journeys, or your cards.'
}
