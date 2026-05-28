/** @type {import('next').NextConfig} */
const nextConfig = {
  // Gate in vercel.json buildCommand via `npm run verify` — avoid duplicate native Next lint/tsc hangs.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
}
module.exports = nextConfig
