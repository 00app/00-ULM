/**
 * ZeroAgent — tool-calling agent for per-category UK household research.
 * Primary: direct Gemini function calling (free tier, GEMINI_API_KEY).
 * Fallback: OpenRouter (google/gemini-2.5-flash via OpenAI-compatible tool calling).
 * The model decides which free UK data APIs to call, executes them, and synthesises
 * a grounded markdown insight with a verified £/year saving and a live https link.
 *
 * No Firecrawl required. All tools are free or zero-auth UK public APIs.
 */

import { AGENT_TOOL_DECLARATIONS, executeAgentTool } from '@/lib/agents/agentTools'
import { EDITORIAL_MAGAZINE_CONSTRAINT } from '@/lib/intelligence/aiGateway'
import type { JourneyId } from '@/lib/journeys'
import { normalizeCategoryToJourneyKey } from '@/lib/zone/trustedJourneyUrls'

const MAX_TOOL_ROUNDS = 5
const MAX_OUTPUT_TOKENS = 1200
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const ROUND_TIMEOUT_MS = 30_000
const GEMINI_AGENT_MODEL = 'gemini-2.5-flash'

// Which tools are relevant per journey — keeps the model focused, reduces hallucination
const CATEGORY_TOOL_HINTS: Partial<Record<JourneyId, string[]>> = {
  home: ['fetch_postcode_geo', 'fetch_epc_data', 'fetch_deprivation_index', 'scrape_url'],
  utilities: ['fetch_postcode_geo', 'fetch_epc_data', 'fetch_grid_intensity', 'scrape_url'],
  grants: ['fetch_postcode_geo', 'fetch_epc_data', 'fetch_deprivation_index', 'fetch_land_registry', 'scrape_url'],
  solar: ['fetch_postcode_geo', 'fetch_solar_estimate', 'fetch_epc_data', 'fetch_dno_region', 'fetch_grid_intensity', 'scrape_url'],
  travel: ['fetch_postcode_geo', 'fetch_deprivation_index', 'scrape_url'],
  holidays: ['fetch_postcode_geo', 'fetch_flood_risk', 'scrape_url'],
  food: ['fetch_postcode_geo', 'fetch_deprivation_index', 'scrape_url'],
  shopping: ['fetch_postcode_geo', 'fetch_deprivation_index', 'fetch_land_registry', 'scrape_url'],
  money: ['fetch_postcode_geo', 'fetch_deprivation_index', 'fetch_land_registry', 'scrape_url'],
  tech: ['fetch_postcode_geo', 'fetch_epc_data', 'fetch_dno_region', 'scrape_url'],
  water: ['fetch_postcode_geo', 'fetch_flood_risk', 'scrape_url'],
  waste: ['fetch_postcode_geo', 'fetch_deprivation_index', 'scrape_url'],
  carbon: ['fetch_postcode_geo', 'fetch_grid_intensity', 'fetch_epc_data', 'fetch_solar_estimate', 'scrape_url'],
}

// OpenAI-format tool declarations (converted from Gemini FunctionDeclaration)
function toOpenAiTools() {
  return AGENT_TOOL_DECLARATIONS.map((d) => ({
    type: 'function' as const,
    function: {
      name: d.name,
      description: d.description,
      parameters: d.parameters,
    },
  }))
}

function buildSystemPrompt(params: {
  postcode: string
  category: string
  journeyKey: JourneyId
  profileBlock: string
  localityContext: string | null
}): string {
  const toolHints = CATEGORY_TOOL_HINTS[params.journeyKey] ?? []
  const toolList = toolHints.length > 0
    ? `Prioritise these tools for the ${params.category} domain: ${toolHints.join(', ')}.`
    : 'Use whichever tools are most relevant.'

  const nowMonth = new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })
  return `You are a trusted UK household savings advisor (${nowMonth}), grounded in real data for postcode ${params.postcode}${params.localityContext ? ` (${params.localityContext})` : ''}.

DOMAIN: ${params.category.toUpperCase()}. Stay strictly within this domain.

${params.profileBlock}

YOUR JOB:
1. Call the tools to gather real data about this household and postcode.
2. ${toolList}
3. Use scrape_url to fetch live policy details or grant amounts from a trusted UK source.
4. Synthesise a 3-paragraph markdown insight — warm, direct, editorial tone. No bullet lists.
5. Include ONE verified £/year saving figure grounded in the tool data.
6. Include ONE live https:// URL to a UK offer, scheme, or comparison page.

${EDITORIAL_MAGAZINE_CONSTRAINT}

RULES:
- Never invent postcode data. Use only what the tools return.
- Never fabricate grant amounts — scrape the actual page or state the tool result.
- Open with the town/area name (from fetch_postcode_geo), never a raw postcode in prose.
- Three paragraphs: friction → current lever → payoff once.
- End paragraph 3 with the saving as: "saving around £NNN a year" (use digits, not words).
- Return markdown only. No JSON, no code fences, no headers.`
}

export type ZeroAgentResult = {
  markdown: string
  toolsUsed: string[]
  citations: Array<{ source_name: string; url: string; snippet: string; title?: string }>
}

type OpenAiMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

type ToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

type OpenAiResponse = {
  choices: Array<{
    message: {
      role: string
      content: string | null
      tool_calls?: ToolCall[]
    }
    finish_reason: string
  }>
}

/** Extract https URLs from the final text, merge with tool-sourced citations. */
function finalizeAgentResult(
  text: string,
  toolsUsed: string[],
  toolCitations: ZeroAgentResult['citations']
): ZeroAgentResult | null {
  const trimmed = text.trim()
  if (trimmed.length < 80) return null

  const urlMatches = trimmed.matchAll(/https:\/\/[^\s\)\]\"<>]+/g)
  const citations: ZeroAgentResult['citations'] = []
  const seen = new Set<string>()
  for (const m of urlMatches) {
    const url = m[0].replace(/[.,;!]+$/, '')
    if (seen.has(url)) continue
    seen.add(url)
    try {
      const host = new URL(url).hostname.replace(/^www\./, '')
      citations.push({ source_name: host, url, snippet: trimmed.slice(0, 320) })
    } catch { /* invalid url */ }
  }

  const mergedCitations = [...toolCitations]
  for (const c of citations) {
    if (!mergedCitations.some((t) => t.url === c.url)) mergedCitations.push(c)
  }
  return { markdown: trimmed, toolsUsed, citations: mergedCitations }
}

/** Run one tool call and capture scrape_url results as citations. */
async function runAgentTool(
  name: string,
  args: Record<string, unknown>,
  toolsUsed: string[],
  toolCitations: ZeroAgentResult['citations']
): Promise<Record<string, unknown>> {
  toolsUsed.push(name)
  const result = await executeAgentTool(name, args)
  if (name === 'scrape_url' && result.found && typeof result.url === 'string') {
    const host = (() => { try { return new URL(result.url as string).hostname.replace(/^www\./, '') } catch { return result.url as string } })()
    toolCitations.push({
      source_name: host,
      url: result.url as string,
      snippet: typeof result.content === 'string' ? (result.content as string).slice(0, 320) : '',
      title: typeof result.title === 'string' ? result.title : undefined,
    })
  }
  return result
}

function agentUserMessage(category: string, pc: string): string {
  return `Research the ${category} domain for postcode ${pc}. Start by fetching postcode geo, then gather relevant data, then synthesise a grounded insight.`
}

/** Primary path — direct Gemini function calling (free tier, no OpenRouter credits). */
async function runZeroAgentGemini(params: {
  pc: string
  category: string
  systemPrompt: string
}): Promise<ZeroAgentResult | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return null
  console.log(`[zeroAgent] model: gemini-direct/${GEMINI_AGENT_MODEL} postcode: ${params.pc} category: ${params.category}`)

  const toolsUsed: string[] = []
  const toolCitations: ZeroAgentResult['citations'] = []

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel(
      {
        model: GEMINI_AGENT_MODEL,
        systemInstruction: params.systemPrompt,
        tools: [{ functionDeclarations: AGENT_TOOL_DECLARATIONS }],
        generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.3 },
      },
      { timeout: ROUND_TIMEOUT_MS }
    )

    const chat = model.startChat()
    let result = await chat.sendMessage(agentUserMessage(params.category, params.pc))

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const calls = result.response.functionCalls()
      if (!calls || calls.length === 0) {
        return finalizeAgentResult(result.response.text() ?? '', toolsUsed, toolCitations)
      }
      const responses = await Promise.all(
        calls.map(async (call) => ({
          functionResponse: {
            name: call.name,
            response: await runAgentTool(
              call.name,
              (call.args ?? {}) as Record<string, unknown>,
              toolsUsed,
              toolCitations
            ),
          },
        }))
      )
      result = await chat.sendMessage(responses)
    }
    return null // hit max rounds without finishing
  } catch (err) {
    console.warn('[zeroAgent] gemini-direct failed:', err instanceof Error ? err.message.slice(0, 200) : err)
    return null
  }
}

/** Fallback path — OpenRouter OpenAI-compatible tool calling. */
async function runZeroAgentOpenRouter(params: {
  pc: string
  category: string
  systemPrompt: string
}): Promise<ZeroAgentResult | null> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) return null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://www.00-00.online'
  const model = process.env.OPENROUTER_MODEL?.trim() || 'google/gemini-2.5-flash'
  const pc = params.pc
  console.log(`[zeroAgent] model: openrouter/${model} postcode: ${pc} category: ${params.category}`)

  const messages: OpenAiMessage[] = [
    { role: 'system', content: params.systemPrompt },
    { role: 'user', content: agentUserMessage(params.category, pc) },
  ]

  const tools = toOpenAiTools()
  const toolsUsed: string[] = []
  const toolCitations: ZeroAgentResult['citations'] = []

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(ROUND_TIMEOUT_MS),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': appUrl,
          'X-Title': '00-00 ZeroAgent',
        },
        body: JSON.stringify({
          model,
          messages,
          tools,
          tool_choice: 'auto',
          max_tokens: MAX_OUTPUT_TOKENS,
          temperature: 0.3,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        console.warn(`[zeroAgent] OpenRouter ${res.status}:`, err.slice(0, 200))
        return null
      }

      const data = (await res.json()) as OpenAiResponse
      const choice = data.choices?.[0]
      if (!choice) return null

      const msg = choice.message
      messages.push({ role: 'assistant', content: msg.content, tool_calls: msg.tool_calls })

      // Model returned final text — we're done
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return finalizeAgentResult(msg.content ?? '', toolsUsed, toolCitations)
      }

      // Execute tool calls in parallel and feed results back
      const toolResults = await Promise.all(
        msg.tool_calls.map(async (call) => {
          let args: Record<string, unknown> = {}
          try { args = JSON.parse(call.function.arguments) } catch { /* ignore */ }
          const result = await runAgentTool(call.function.name, args, toolsUsed, toolCitations)
          return {
            role: 'tool' as const,
            tool_call_id: call.id,
            content: JSON.stringify(result),
          }
        })
      )

      messages.push(...toolResults)
    }

    return null // hit max rounds without finishing
  } catch (err) {
    console.warn('[zeroAgent] failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * ZeroAgent entry — direct Gemini first (free tier), OpenRouter as fallback.
 * Returns null when neither provider is configured or both fail.
 */
export async function runZeroAgent(params: {
  postcode: string
  category: string
  profileBlock: string
  localityContext?: string | null
}): Promise<ZeroAgentResult | null> {
  const pc = params.postcode.replace(/\s+/g, '').toUpperCase()
  const systemPrompt = buildSystemPrompt({
    postcode: pc,
    category: params.category,
    journeyKey: normalizeCategoryToJourneyKey(params.category),
    profileBlock: params.profileBlock,
    localityContext: params.localityContext ?? null,
  })

  const viaGemini = await runZeroAgentGemini({ pc, category: params.category, systemPrompt })
  if (viaGemini) return viaGemini

  return runZeroAgentOpenRouter({ pc, category: params.category, systemPrompt })
}
