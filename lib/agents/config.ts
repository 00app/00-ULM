/**
 * In-repo agent / tool flags for OpenClaw and discovery pipelines.
 * OpenClaw gateway may read its own openclaw.json; this module is the app-side contract.
 */

export const ZERO_RESEARCH_AGENT = {
  id: 'ZeroResearch' as const,
  /** When true, ZeroResearch should use Firecrawl (set matching plugin in OpenClaw + FIRECRAWL_API_KEY in env). */
  tools: {
    firecrawl: true,
  },
} as const

/** Optional extra fields to merge into POST /tools/invoke when your gateway version supports them. */
export function zeroResearchInvokeExtras(): Record<string, unknown> {
  return {
    tools: { ...ZERO_RESEARCH_AGENT.tools },
  }
}
