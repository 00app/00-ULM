// API client utilities — profile session creation only.

export async function createUser(profile: {
  name: string
  postcode: string
  household: string
  home_type: string
  transport: string
  age_group?: string
  employment_status?: string
  /** `money` | `carbon` | `balanced` — stored in `users.user_genome.profile_goal`. */
  goal?: string
  house_number?: string
  home_power?: string
}) {
  const response = await fetch('/api/user', {
    method: 'POST',
    // Onboarding navigates away (window.location.assign) shortly after this call races against
    // an 8s timeout — without keepalive, that hard navigation aborts the fetch mid-flight and the
    // browser never receives the Set-Cookie session header, even though the account was created
    // server-side. That's how a real account ends up looking like "Guest" forever.
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...profile,
      age_group: profile.age_group ?? null,
      goal: profile.goal ?? undefined,
    }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    const errorMessage = error.error || error.details || `Failed to create user: ${response.status}`
    throw new Error(errorMessage)
  }
  return response.json()
}

export async function getLikes() {
  const response = await fetch('/api/likes', { credentials: 'include' })
  if (!response.ok) throw new Error('Failed to fetch likes')
  return response.json()
}
