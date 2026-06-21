/**
 * Audit public Neon tables: existence, row counts, and app hot-path status.
 * Run: npm run db:audit
 */
import { loadEnvLocal } from './load-env-local'
import { Pool } from 'pg'
import { sanitizeNeonConnectionString } from '../lib/db'

loadEnvLocal({ preferLocal: true })

type TableStatus = 'hot' | 'mirror' | 'legacy-unused' | 'optional'

const TABLE_META: Record<string, { status: TableStatus; note: string }> = {
  users: { status: 'hot', note: 'Auth + profile genome' },
  sessions: { status: 'hot', note: 'Login cookies' },
  journeys: { status: 'optional', note: 'Sentinel upserts journey_key; /api/journey should match' },
  journey_state: { status: 'hot', note: 'Sentinel home state waterfall' },
  journey_answers: { status: 'hot', note: 'Normalized rows; FK for discovery_injections.parent_answer_id' },
  journey_answers_jsonb: { status: 'hot', note: 'Primary read path for Zone/Zai' },
  journey_questions: { status: 'hot', note: '13-domain question bank (npm run db:evolve-13-domains)' },
  guest_sessions: { status: 'hot', note: 'Guest profile + answers by session_id / IP' },
  cards: { status: 'legacy-unused', note: 'Only /api/cards — no UI callers' },
  card_views: { status: 'legacy-unused', note: 'Never written in app; safe to drop' },
  micro_answers: { status: 'legacy-unused', note: 'Never written; safe to drop' },
  likes: { status: 'hot', note: 'Likes page + track API' },
  user_actioned_cards: { status: 'hot', note: 'Truth vs potential' },
  discovery_injections: { status: 'hot', note: 'Card birth audit trail (max 3 per journey_key)' },
  research_results: { status: 'hot', note: 'JIT scrape + Hermes repair; research_snapshot JSONB' },
  scraped_summary: { status: 'hot', note: '001 crawler hero totals per journey_key' },
  user_profiles: { status: 'mirror', note: 'Hermes / Solo Focus genome mirror' },
  zai_messages: { status: 'legacy-unused', note: 'Schema only — chat is client + /api/zai' },
  zone_questions: { status: 'legacy-unused', note: 'Superseded by journey_questions — drop when empty' },
  user_answers: { status: 'legacy-unused', note: 'Superseded by journey_answers_jsonb — drop when empty' },
  user_likes: { status: 'legacy-unused', note: 'Superseded by likes — drop when empty' },
}

function safeIdentifier(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Invalid table name: ${name}`)
  }
  return name
}

async function main() {
  const rawUrl = sanitizeNeonConnectionString(process.env.DATABASE_URL?.trim() ?? '')
  if (!rawUrl) {
    console.error('❌ DATABASE_URL missing — set in .env.local')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: rawUrl, max: 4 })
  try {
    const tables = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    )

    console.log('━━━ Neon public tables ━━━\n')
    for (const { tablename } of tables.rows) {
      const meta = TABLE_META[tablename]
      let count = '?'
      try {
        const c = await pool.query<{ n: string }>(
          `SELECT COUNT(*)::text AS n FROM ${safeIdentifier(tablename)}`
        )
        count = c.rows[0]?.n ?? '0'
      } catch {
        count = '(count failed)'
      }
      const tag = meta?.status ?? 'optional'
      const note = meta?.note ?? 'Not catalogued — verify before drop'
      console.log(`${tablename.padEnd(28)} rows=${String(count).padStart(6)}  [${tag}]  ${note}`)
    }

    console.log('\n━━━ Required for Zai + Zone (verify-discovery-schema) ━━━')
    for (const t of ['discovery_injections', 'journey_answers_jsonb', 'journey_answers', 'likes'] as const) {
      const res = await pool.query<{ reg: string | null }>(
        `SELECT to_regclass($1) AS reg`,
        [`public.${t}`]
      )
      console.log(`${res.rows[0]?.reg ? '✓' : '✗'} ${t}`)
    }

    console.log('\n━━━ Safe cleanup candidates (20260521 + 20260526) ━━━')
    for (const t of [
      'card_views',
      'micro_answers',
      'zai_messages',
      'zone_questions',
      'user_answers',
      'user_likes',
    ] as const) {
      const res = await pool.query<{ reg: string | null }>(
        `SELECT to_regclass($1) AS reg`,
        [`public.${t}`]
      )
      if (!res.rows[0]?.reg) {
        console.log(`  (absent) ${t}`)
        continue
      }
      const c = await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM ${safeIdentifier(t)}`
      )
      console.log(`  ${t}: ${c.rows[0]?.n ?? '0'} rows — drop only if zero or confirmed unused`)
    }

    console.log('\nHermes: no schema change needed for Zai read-only / JIT scrape boundaries.')
    console.log('VPS cron still hits /api/cron/zone-research?repair=1 — see docs/HERMES-ULM-JIT-BRIEF.md\n')
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
