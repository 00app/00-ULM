# Zero Zero — Deploy Report

**Date:** February 2, 2026  
**Purpose:** Final test before delivering 4-step deploy instructions

---

## 1. Local dev server

| Item | Status |
|------|--------|
| Command | `npm run dev` |
| Status | **Running** (started in background) |
| URL | **http://localhost:3000** |
| Action | Open in browser: http://localhost:3000 |

---

## 2. Vercel deploy

| Item | Status |
|------|--------|
| Deploy command | `npx vercel --yes` (preview) or `npx vercel --prod` (production) |
| Status | **Blocked** — not run successfully in this session |
| Reason | `The specified token is not valid. Use 'vercel login' to generate a new token.` |
| Project config | `vercel.json` present: Next.js, buildCommand, region `iad1` |

**To deploy from your machine:** run `vercel login` once, then `npx vercel --yes` (or `--prod`).

---

## 3. Build check

- **Local build:** `npm run build` was started but timed out in the test environment (builds can take 1–2+ minutes).
- **Vercel:** Will run `npm run build` on deploy; no local build required for deployment.

---

## 4. Four steps to make deploy happen

Use these as the deliverable “4 steps”:

1. **Log in to Vercel**  
   In the project directory, run:
   ```bash
   npx vercel login
   ```
   Complete the browser/email login so the CLI is authenticated.

2. **Deploy (preview)**  
   Deploy a preview and get a URL:
   ```bash
   npx vercel --yes
   ```
   Or deploy to production:
   ```bash
   npx vercel --prod
   ```

3. **Open the deployed site**  
   The CLI prints a URL (e.g. `https://zero-zero-xxx.vercel.app`). Open it in a browser to verify.

4. **Open local (optional)**  
   For local testing:
   ```bash
   npm run dev
   ```
   Then open **http://localhost:3000**.

---

## 5. Environment variables (if needed)

- If the app uses **Neon** or other secrets, add them in the Vercel dashboard: **Project → Settings → Environment Variables**.
- `DATABASE_URL` (or equivalent) must be set in Vercel for server-side DB access.

---

## Summary

| Check | Result |
|-------|--------|
| Local dev server | Running at http://localhost:3000 |
| Vercel deploy | Requires `vercel login` then `npx vercel --yes` or `--prod` |
| Config | `vercel.json` and Next.js setup are in place |
| 4-step instructions | Documented above for handoff |
