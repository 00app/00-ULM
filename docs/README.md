# Zero Zero documentation

All **product and ops** documentation for the **00-00** repo lives in this folder.

## Start here — one document

| Doc | Use when |
|-----|----------|
| **[HANDBOOK.md](HANDBOOK.md)** | **Master audit doc** — pipeline map, APIs, credit boundaries, scrape URL registry, copy, loops (synthesized front + full annexes) |

Open **`HANDBOOK.md`** to check everything in one place. The annex sections are the full text of each satellite doc (regenerate with `python3 scripts/consolidate-handbook.py` after editing sources).

## Satellite docs (edit these first, then consolidate)

| File | Topic |
|------|--------|
| [USER-FLOW-AND-DATA-PIPELINE.md](USER-FLOW-AND-DATA-PIPELINE.md) | User flow, category contract, deploy checklist |
| [ZONE-CONTENT-AND-DATA.md](ZONE-CONTENT-AND-DATA.md) | Scrape, copy, bento, Solo Focus, tone |
| [PROFILE-ANSWERS-ZONE-TECH.md](PROFILE-ANSWERS-ZONE-TECH.md) | Questions, answers API, scrape-sync |
| [ZAI-AND-QUESTIONS-RULES.md](ZAI-AND-QUESTIONS-RULES.md) | Zai boundaries + question registry |
| [HYBRID-DATA-PIPELINE.md](HYBRID-DATA-PIPELINE.md) | API cost tiers |
| [ULM-APPLICATION-LOOP.md](ULM-APPLICATION-LOOP.md) | Ceilings, spawn, headline limits |
| [INTELLIGENCE-LOOP-MANIFEST.md](INTELLIGENCE-LOOP-MANIFEST.md) | Hermes, Firecrawl, Gemini persist |
| [FULL-APP-SPEC.md](FULL-APP-SPEC.md) | Full architecture, APIs, DB |
| [PRODUCT-ARCHITECTURE-SPEC.md](PRODUCT-ARCHITECTURE-SPEC.md) | Product architecture notes |
| [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md) | Vercel CI, promote, Node |
| [DEV-TEST-AUDIT.md](DEV-TEST-AUDIT.md) | Local smoke, SQL, Hermes |
| [MOTION-FAMILY.md](MOTION-FAMILY.md) | Motion DNA (delivery only) |
| [HERMES-VPS-SETUP.md](HERMES-VPS-SETUP.md) | Oracle VPS cron |
| [HERMES-ULM-JIT-BRIEF.md](HERMES-ULM-JIT-BRIEF.md) | JIT scrape vs Hermes |
| [SENTINEL.md](SENTINEL.md) | Sentinel live layer |
| [SUPPLEMENTAL-SYSTEMS.md](SUPPLEMENTAL-SYSTEMS.md) | Gary mode, pattern shift, inject paths |
| [PUBLIC-UK-APIS.md](PUBLIC-UK-APIS.md) | UK public API reference |
| [APP-FLOW-AND-PIPELINE.md](APP-FLOW-AND-PIPELINE.md) | Architect spec (routes, governance) |

## Not in `docs/` (by design)

| Path | Why |
|------|-----|
| **[../README.md](../README.md)** | GitHub / npm repo entry (links here) |
| **`../config/README.md`** | Config folder convention |
| **`../.cursor/rules/`** | Cursor agent rules |
| **`../.agents/AGENTS.md`** | Agent orchestration manifest |
| **`../lib/agents/ZeroHunter/SOUL.md`** | Agent persona next to code |
