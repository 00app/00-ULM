const path = require('path')

/**
 * Prefer `.env.local` over stale shell exports — matches `scripts/load-env-local` + `preferLocal: true`.
 * Omit on Vercel (dashboard env wins).
 */
if (!process.env.VERCEL) {
  try {
    const { loadEnvLocal } = require('./scripts/load-env-local.cjs')
    loadEnvLocal({ preferLocal: true })
  } catch {
    /* ignore malformed env file */
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /** Hide Next.js dev overlay indicator (was overlapping brand / feeling “stuck” on the mark). */
  devIndicators: false,
  // Allow local dev access from both localhost and 127.0.0.1 so HMR/hydration isn't blocked.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  /** Expose Vercel deploy type to client (Pulse widget on preview; prod uses NEXT_PUBLIC_PULSE_WIDGET). */
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? '',
  },
  // Reduce build parallelism to avoid ENOENT races (manifest/static dirs)
  experimental: { cpus: 1 },
  // Avoid stale dev cache causing "__webpack_modules__[moduleId] is not a function"
  webpack: (config, { dev }) => {
    // Dev stability on macOS: avoid EMFILE ("too many open files") by polling + ignoring heavy dirs.
    // When Watchpack fails, Next may fail to discover App Router pages and everything becomes 404.
    if (dev) {
      // Memory cache avoids ENOSPC on full disks (filesystem cache under `.next/cache/webpack` can be hundreds of MB).
      // Set ZERO_DEV_WEBPACK_FS_CACHE=1 to re-enable filesystem cache when you have plenty of free space.
      const useFsCache = process.env.ZERO_DEV_WEBPACK_FS_CACHE === '1'
      config.cache = useFsCache
        ? {
            type: 'filesystem',
            cacheDirectory: path.join(__dirname, '.next/cache/webpack'),
            buildDependencies: { config: [__filename] },
          }
        : { type: 'memory' }
      config.watchOptions = {
        ...(config.watchOptions ?? {}),
        // Polling avoids macOS EMFILE when many `next dev` / editors hold FDs; pair with WATCHPACK_POLLING in npm scripts.
        poll: 1000,
        aggregateTimeout: 300,
        ignored: [
          '**/.git/**',
          '**/.next/**',
          '**/node_modules/**',
          '**/.cursor/**',
          '**/test-results/**',
          '**/playwright-report/**',
          '**/coverage/**',
          '**/export/**',
          '**/*.tsbuildinfo',
        ],
      }
    }
    return config
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
}

module.exports = nextConfig
