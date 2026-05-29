/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lint + tsc run in vercel.json `buildCommand` via `npm run verify` (eslint.config.mjs + tsc:check).
  // Do not set `eslint` here — Next 16 removed that option and Vercel native Lint checks crash with "internal error".
  typescript: { ignoreBuildErrors: true },
}
module.exports = nextConfig
