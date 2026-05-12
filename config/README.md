# OpenClaw configuration (Zero Zero backend)

Copy `openclaw.json.example` to `~/.openclaw/openclaw.json` and set:

- **GEMINI_API_KEY** — Google AI Studio (Gemini 3 Flash).
- **OPENCLAW_GATEWAY_TOKEN** — Token for Next.js ↔ gateway auth (`gateway.auth.mode: "token"`).
- **FIRECRAWL_API_KEY** — Used by `lib/agents/researchAgent.ts` for UK grant scraping (optional; fallback when gateway is not running).

Then run:

```bash
npm install -g openclaw@latest && openclaw onboard --install-daemon
```

Firecrawl is used by the ZeroResearch agent when scraping JS-heavy UK energy/grant sites; the gateway’s `tools.web.fetch` can be extended with a Firecrawl fallback via plugins or env. See `config/openclaw/agents/ZeroResearch/SOUL.md` for ZeroResearch personality and research rules.
