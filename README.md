# Zero Zero

A mobile-first web app that helps people understand and reduce their everyday impact on money, energy, carbon, and home life.

---

## Full flow: Build → Cursor → Ports → Deploy → GitHub → Neon

One sequence that **builds locally, runs in Cursor, uses a clear port, deploys to Vercel, backs up to GitHub, and keeps Neon connected**.

| Step | Command / action | What it does |
|------|------------------|---------------|
| 1. Open in Cursor | Open this folder in Cursor | Project is ready to edit and run. |
| 2. Install | `npm install` | Dependencies (once). |
| 3. Env (local) | Copy `.env.example` → `.env.local`, set `DATABASE_URL` | Local dev talks to Neon. |
| 4. Build locally | `npm run build` | Confirms the app builds; uses local or fallback DB. |
| 5. Run dev | `npm run dev` | App at **http://localhost:3000**. |
| 5b. Alternate port | `npm run dev:alt` | App at **http://localhost:3001** (e.g. second instance). |
| 6. Deploy to Vercel | `npm run deploy` or `vercel --prod --yes` | Builds on Vercel, deploys production. **Neon** is connected via `DATABASE_URL` in Vercel env. |
| 7. Backup to GitHub | `git add . && git commit -m "..." && git push origin main` | Backs up code to **00app/00-ULM**. Pushes to `main` also trigger Vercel deploys if the project is linked. |

**All connected:**

- **Neon** ↔ **Local:** `DATABASE_URL` in `.env.local`.
- **Neon** ↔ **Vercel:** `DATABASE_URL` in Vercel project env (Production/Preview).
- **Gemini (Zai)** ↔ **Vercel:** `GEMINI_API_KEY` in Vercel project env (Production/Preview).
- **GitHub** ↔ **Vercel:** Repo `00app/00-ULM` linked to Vercel project; push `main` → deploy.
- **Cursor:** Open this repo; run `npm run dev` or `npm run dev:alt` to run locally.

**One-shot build + deploy (no git):**

```bash
npm run ship
```

Runs `npm run build` then `npm run deploy`. Use `git push origin main` yourself for backup.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Neon Postgres database (connection string provided)

### Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (link to Neon and Gemini):
   - **Neon (Postgres):** Create a project at [Neon Console](https://console.neon.tech), create a database, and copy the connection string from the dashboard (Connection details).
   - **Local:** Copy `.env.example` to `.env.local` and set `DATABASE_URL` and `GEMINI_API_KEY`.
   - **Vercel (for APIs):** Project → Settings → Environment Variables → add `DATABASE_URL` and `GEMINI_API_KEY` (Production + Preview). See [Connect Vercel for APIs](#3-connect-vercel-for-apis-environment-variables) below.

3. Initialize the database schema:
```bash
npm run init-db
```

4. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### API Endpoints

- `GET /api/health` - Database connectivity check
- `POST /api/user` - Create/update user profile
- `POST /api/answers` - Save journey answer
- `POST /api/journey` - Update journey state
- `GET /api/cards` - Get card definitions
- `POST /api/likes` - Toggle like on a card
- `GET /api/likes` - Get user's liked cards
- `GET /api/space` - Get Space items (always returns exactly 6 items)
- `POST /api/zai` - Zai chat (requires `GEMINI_API_KEY` in Vercel env)
- `GET /api/scrape-sync` - Scraped dashboard data; `POST` accepts crawler payload (optional `SCRAPER_SECRET` + `x-scraper-key` for auth)

## Documentation

- **PROJECT-SPECIFICATION.md** — Single project spec: overview, user flow, design system, data model, calculations, app logic, APIs, S Update, Groovy Grid, and setup.

---

## Deploy to Vercel via GitHub

**Repository:** `git@github.com:00app/00-ULM.git`  
**Vercel project ID:** `prj_vFWtVnYgOU4tzxdkT6qsiLrDi7Kj`

### 1. Push code to GitHub

```bash
git remote -v   # confirm origin is git@github.com:00app/00-ULM.git
git push -u origin main
```

Create the repo **00-ULM** under the **00app** org on GitHub first if it doesn’t exist.

### 2. Import the project in Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (use **Continue with GitHub**).
2. Click **Add New… → Project**.
3. **Import** the **00app/00-ULM** repository (grant Vercel access to the 00app org if prompted).
4. Leave the defaults (Framework: Next.js, Build Command: `npm run build`, etc.).  
   `vercel.json` already sets these.
5. Click **Deploy**.

Every push to `main` (or your production branch) will trigger a new deployment.

### 3. Connect Vercel for APIs (environment variables)

Set these in Vercel so the deployed app can use the database and Gemini (Zai):

1. Open your project on [Vercel](https://vercel.com) → **Settings** → **Environment Variables**.
2. Add:

   | Name             | Value                    | Environments   |
   |------------------|--------------------------|----------------|
   | `DATABASE_URL`   | Your Neon connection string (same as in `.env.local`) | Production, Preview |
   | `GEMINI_API_KEY` | Your Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) | Production, Preview |
   | `SCRAPER_SECRET` | (Optional) Secret for `POST /api/scrape-sync`; crawler sends as `x-scraper-key` header | Production, Preview |

3. Click **Save** for each variable.
4. **Redeploy** the project (Deployments → ⋮ on latest → Redeploy) so the new variables are applied.

After this, `/api/zai` (Zai chat) and all database-backed APIs will work on **https://00-ulm.vercel.app** (or your project URL).

### 4. Optional: connect a custom domain

In **Project → Settings → Domains** add your domain and follow the DNS steps.
