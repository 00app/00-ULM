/** @type {import('next').NextConfig} */
const { loadEnvLocal } = require('./scripts/load-env-local.cjs')
// `.env.local` wins over stale exported shell vars (common DATABASE_URL mismatch).
loadEnvLocal({ preferLocal: true })

const nextConfig = {
  // Lint + tsc run in vercel.json `buildCommand` via scripts/vercel-build-gate.mjs (eslint + tsc:check).
  // Do not set `eslint` here — Next 16 removed that option and Vercel native Lint checks crash with "internal error".
  typescript: { ignoreBuildErrors: true },
}
module.exports = nextConfig
