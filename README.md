# Zero Zero

Mobile-first web app for understanding and reducing everyday impact on money, energy, carbon, and home life (UK-first, postcode-driven).

---

## Quick start

```bash
npm install
cp .env.example .env.local   # DATABASE_URL, GEMINI_API_KEY, etc. — never commit .env.local
npm run init-db
npm run dev                  # http://127.0.0.1:3000 (see package.json for :3030 / :3001 variants)
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) when using default `npm run dev`.

**Verify:** `npm run verify` · **Build:** `npm run build` · **Deploy:** `npm run deploy` (auto-promote) · **Staged fix:** `npm run promote`

**Dev stack:** `npm run dev:pipeline-ready` · **Hermes:** `npm run hermes:ping`

**Typecheck:** `npm run check` · **E2E:** `npm run test:e2e`

Docs: **[docs/HANDBOOK.md](docs/HANDBOOK.md)** · **[docs/USER-FLOW-AND-DATA-PIPELINE.md](docs/USER-FLOW-AND-DATA-PIPELINE.md)** · index: **[docs/README.md](docs/README.md)**

---

## Connections

- **Neon** ↔ `DATABASE_URL`
- **Gemini** ↔ `GEMINI_API_KEY`
- **GitHub** ↔ Vercel (push to deploy)

---

## Security

Never commit `.env.local`. Run **`npm run audit`**. Details: **[docs/HANDBOOK.md](docs/HANDBOOK.md)** → Security.
