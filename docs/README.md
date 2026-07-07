# Zero Zero documentation

**Start here:** [GUARDRAILS-AND-PIPELINE.md](GUARDRAILS-AND-PIPELINE.md) — one map for rules, code gates, CI, and the true data pipeline.

---

## Tier 1 — Daily use

| Doc | Use when |
| --- | --- |
| **[GUARDRAILS-AND-PIPELINE.md](GUARDRAILS-AND-PIPELINE.md)** | **Canonical** — guardrails, pipeline, personalization, ship workflow |
| **[APP-OVERVIEW-AND-TESTING.md](APP-OVERVIEW-AND-TESTING.md)** | Content sources, £/kg math, full UAT matrix |
| **[INTELLIGENCE-PIPELINE-FINAL.md](INTELLIGENCE-PIPELINE-FINAL.md)** | When scrapes fire, read path, Hermes repair |
| **[DEV-TEST-AUDIT.md](DEV-TEST-AUDIT.md)** | Local smoke, deploy, env health |

## Tier 2 — Feature depth (edit first, then consolidate)

| Doc | Topic |
| --- | --- |
| [PROFILE-FIELDS-GRID-UNLOCKS.md](PROFILE-FIELDS-GRID-UNLOCKS.md) | Profile + MC → JIT, grid, SMS |
| [PROFILE-ANSWERS-ZONE-TECH.md](PROFILE-ANSWERS-ZONE-TECH.md) | Questions, answers API, scrape-sync |
| [ZONE-CONTENT-AND-DATA.md](ZONE-CONTENT-AND-DATA.md) | Copy, bento, Solo Focus |
| [ULM-APPLICATION-LOOP.md](ULM-APPLICATION-LOOP.md) | Ceilings, discovery injects |
| [ZAI-AND-QUESTIONS-RULES.md](ZAI-AND-QUESTIONS-RULES.md) | Zai boundaries, question registry |
| [USER-FLOW-AND-DATA-PIPELINE.md](USER-FLOW-AND-DATA-PIPELINE.md) | User journey narrative |

## Tier 3 — Ops & infra

| Doc | Topic |
| --- | --- |
| [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md) | Vercel CI, promote |
| [HERMES-VPS-SETUP.md](HERMES-VPS-SETUP.md) | Vercel Cron (retired Oracle VPS runbook) |
| [HERMES-ULM-JIT-BRIEF.md](HERMES-ULM-JIT-BRIEF.md) | JIT vs Hermes repair |
| [HYBRID-DATA-PIPELINE.md](HYBRID-DATA-PIPELINE.md) | API cost tiers |
| [SENTINEL.md](SENTINEL.md) | Sentinel live layer |
| [SUPPLEMENTAL-SYSTEMS.md](SUPPLEMENTAL-SYSTEMS.md) | Gary mode, pattern shift |

## Tier 4 — Reference

| Doc | Topic |
| --- | --- |
| [FULL-APP-SPEC.md](FULL-APP-SPEC.md) | Full architecture, APIs, DB |
| [PUBLIC-UK-APIS.md](PUBLIC-UK-APIS.md) | UK public APIs |
| [MOTION-FAMILY.md](MOTION-FAMILY.md) | Motion DNA |
| [SECURITY-AUDIT.md](SECURITY-AUDIT.md) | Security notes |
| [PRODUCT-ROADMAP.md](PRODUCT-ROADMAP.md) | Phase checklist |

## Generated audit mirror

| Doc | Regenerate |
| --- | --- |
| **[HANDBOOK.md](HANDBOOK.md)** | `python3 scripts/consolidate-handbook.py` |

---

## Not in `docs/` (by design)

| Path | Role |
| --- | --- |
| [../.cursor/rules/](../.cursor/rules/) | Cursor agent rules (always on) |
| [../.agents/AGENTS.md](../.agents/AGENTS.md) | Agent orchestration |
| [../lib/logic/engine.ts](../lib/logic/engine.ts) | Economics constants |
| [../scripts/verify-mechanical-truth.ts](../scripts/verify-mechanical-truth.ts) | CI mechanical truth |

## Ship gate (one line)

```bash
npm run verify && npm run deploy
```
