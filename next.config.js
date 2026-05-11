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
    if (dev) config.cache = false
    // Dev stability on macOS: avoid EMFILE ("too many open files") by polling + ignoring heavy dirs.
    // When Watchpack fails, Next may fail to discover App Router pages and everything becomes 404.
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions ?? {}),
        // Polling avoids macOS EMFILE when many `next dev` / editors hold FDs; pair with WATCHPACK_POLLING in npm scripts.
        poll: 500,
        aggregateTimeout: 200,
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
