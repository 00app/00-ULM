# Zero Zero

Mobile-first web app for understanding and reducing everyday impact on money, energy, carbon, and home life.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # set DATABASE_URL, GEMINI_API_KEY — never commit .env.local (it's in .gitignore)
npm run init-db
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- **Build:** `npm run build`
- **Deploy:** `npm run deploy` or `vercel --prod --yes`
- **One-shot:** `npm run ship` (build + deploy)

---

## Documentation

- **Single source of truth:** [PROJECT-SPECIFICATION.md](PROJECT-SPECIFICATION.md) — product, routes, design system, APIs, v1.8 production lock, and setup.
- **`docs/README.md`** — pointer only; do not add more markdown here.

---

## Connections

- **Neon** ↔ local/Vercel via `DATABASE_URL`
- **Gemini (Zai)** ↔ Vercel via `GEMINI_API_KEY`
- **GitHub** ↔ Vercel: push `main` to deploy (repo `00app/00-ULM`)

---

## Security

- **Never commit** `.env.local`; it is gitignored. If any secret was committed or exposed, rotate it (new DB password, new API key) and remove it from history.
- Run **`npm run audit`** and fix reported vulnerabilities.
- See **[SECURITY.md](SECURITY.md)** for secrets handling, auth, and dependency security.
