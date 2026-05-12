/**
 * In-repo agent / tool flags for ZeroResearch and discovery pipelines.
 */

export const ZERO_RESEARCH_AGENT = {
  id: 'ZeroResearch' as const,
  /** When true, ZeroResearch should use Firecrawl (`FIRECRAWL_API_KEY`). */
  tools: {
    firecrawl: true,
  },
} as const

/** Optional extra fields merged into internal research invoke metadata. */
export function zeroResearchInvokeExtras(): Record<string, unknown> {
  return {
    tools: { ...ZERO_RESEARCH_AGENT.tools },
  }
}
