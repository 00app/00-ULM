/**
 * Shared client for POST /api/zai — Zai page + Ask Zai Deep Dive sheet.
 */

export type ZaiChatMessage = { role: 'user' | 'zai'; text: string }

export type ZaiExpandedContext = {
  category: string
  personalSpend?: string
  regionalAvg?: string
  shift_title?: string
  userContext?: unknown
  scraped_source?: string
  journey_answers_jsonb?: Record<string, Record<string, string>>
  journey_question_label?: string
}

export type ZaiContextData = {
  totals?: { totalMoney: number; totalCarbon: number }
  postcode?: string
  council?: string
  goal?: string
}

export type PostZaiChatParams = {
  question: string
  stream?: boolean
  messages?: ZaiChatMessage[]
  expandedContext?: ZaiExpandedContext
  contextData?: ZaiContextData
  journey_answers?: Record<string, Record<string, string>>
  postcode?: string
}

export async function readZaiStream(
  res: Response,
  onChunk: (chunk: string) => void
): Promise<string> {
  // A JSON body means the route answered `{ answer }` instead of streaming — show the sentence, not the JSON.
  if (res.headers.get('content-type')?.includes('application/json')) {
    const data = (await res.json().catch(() => null)) as { answer?: unknown } | null
    const answer = typeof data?.answer === 'string' ? data.answer : ''
    if (answer) onChunk(answer)
    return answer
  }
  if (!res.body) return ''
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    if (!chunk) continue
    full += chunk
    onChunk(chunk)
  }
  full += decoder.decode()
  return full
}

export async function postZaiChat(params: PostZaiChatParams): Promise<Response> {
  const journeyAnswers = params.journey_answers
  return fetch('/api/zai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      question: params.question,
      stream: params.stream !== false,
      messages: params.messages?.map((m) => ({ role: m.role, text: m.text })),
      expandedContext: params.expandedContext,
      contextData: params.contextData,
      journey_answers: journeyAnswers,
      journeyAnswersFromClient: journeyAnswers,
      postcode: params.postcode,
    }),
  })
}
