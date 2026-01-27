// API client utilities

export async function createUser(profile: {
  name: string
  postcode: string
  household: string
  home_type: string
  transport: string
}) {
  const response = await fetch('/api/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    const errorMessage = error.error || error.details || `Failed to create user: ${response.status}`
    throw new Error(errorMessage)
  }
  return response.json()
}

export async function saveAnswer(
  user_id: string,
  journey_id: string,
  question_id: string,
  answer: string
) {
  const response = await fetch('/api/answers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, journey_id, question_id, answer }),
  })
  if (!response.ok) throw new Error('Failed to save answer')
  return response.json()
}

export async function updateJourney(
  user_id: string,
  journey_id: string,
  state: 'not_started' | 'in_progress' | 'completed'
) {
  const response = await fetch('/api/journey', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, journey_id, state }),
  })
  if (!response.ok) throw new Error('Failed to update journey')
  return response.json()
}

export async function getCards(journey_id?: string, type?: string) {
  const params = new URLSearchParams()
  if (journey_id) params.append('journey_id', journey_id)
  if (type) params.append('type', type)
  const response = await fetch(`/api/cards?${params.toString()}`)
  if (!response.ok) throw new Error('Failed to fetch cards')
  return response.json()
}

export async function toggleLike(user_id: string, card_id: string) {
  const response = await fetch('/api/likes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, card_id }),
  })
  if (!response.ok) throw new Error('Failed to toggle like')
  return response.json()
}

export async function getLikes(user_id: string) {
  const response = await fetch(`/api/likes?user_id=${user_id}`)
  if (!response.ok) throw new Error('Failed to fetch likes')
  return response.json()
}

export async function getZone(user_id: string) {
  const response = await fetch(`/api/zone?user_id=${user_id}`)
  if (!response.ok) throw new Error('Failed to fetch zone')
  return response.json()
}

// Legacy alias for backward compatibility
export async function getSpace(user_id: string) {
  return getZone(user_id)
}
