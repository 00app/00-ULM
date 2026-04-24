# Security

## Secrets and environment variables

- **Never commit** `.env.local` or any file containing real credentials. It is listed in `.gitignore` (`.env*.local`).
- Store only **placeholders** in `.env.example`; copy to `.env.local` and fill in values locally.
- If **DATABASE_URL**, **GEMINI_API_KEY**, or any secret was ever committed or shared:
  1. **Rotate immediately**: generate new DB credentials (Neon), new API key (Google AI Studio), revoke/rotate any OIDC or Vercel tokens.
  2. Remove the secret from git history (e.g. `git filter-repo` or BFG) and force-push after rotation.
- Use your platform’s secret storage (e.g. Vercel Environment Variables) for production; never paste production secrets into code or docs.
- **`GEMINI_API_KEY`** and **`DATABASE_URL`** are **server-only**: use `process.env` in API routes and server modules only. Never expose them with a `NEXT_PUBLIC_` prefix or embed them in client bundles.

## Authentication

- Login is protected by **rate limiting** (per-IP and per-account) to reduce brute-force risk.
- Sessions use **httpOnly**, **secure** (in production), and **sameSite: 'lax'** cookies; tokens are stored server-side and validated on each request.
- Use the **logout** endpoint (`POST /api/auth/logout`) to invalidate the session and clear the cookie when the user signs out.

## Dependencies

- Run **`npm run audit`** regularly and address reported vulnerabilities.
- Keep **Next.js**, **React**, **pg**, and **bcryptjs** updated for security patches.

## Reporting issues

If you find a security vulnerability, please report it privately (e.g. to the maintainers) rather than opening a public issue.
