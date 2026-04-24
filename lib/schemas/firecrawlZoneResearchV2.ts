/**
 * Firecrawl / extract pipeline: JSON Schema for Zone + economy research payloads.
 * Source file: schemas/firecrawl-zone-research.v2.json
 */
import firecrawlZoneResearchV2Schema from '../../schemas/firecrawl-zone-research.v2.json'

export const FIRECRAWL_ZONE_RESEARCH_V2_SCHEMA_VERSION = '2.0.0' as const

/** Full JSON Schema object (draft-07) — pass to Firecrawl `extract` / agent structured output. */
export const firecrawlZoneResearchV2JsonSchema = firecrawlZoneResearchV2Schema as Record<string, unknown>

export function getFirecrawlZoneResearchV2SchemaPath(): string {
  return 'schemas/firecrawl-zone-research.v2.json'
}
