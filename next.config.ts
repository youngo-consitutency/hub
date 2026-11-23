import { withPayload } from '@payloadcms/next/withPayload'
import { withSentryConfig } from '@sentry/nextjs/config'
import type { NextConfig } from 'next'
import { LEGACY_SITE_PATHS } from './src/shared/publicRoutes'
import path from 'path'
import { fileURLToPath } from 'url'
import { isIndexable } from './src/lib/environment'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  // `next dev` otherwise appends its own rules block to AGENTS.md on every run;
  // agent guidance lives in AGENTS.md and .agents/skills.
  agentRules: false,
  // Dockerfile and other self-hosted targets consume the standalone output.
  // Vercel and `next start` need the default output, so standalone is opt-in.
  output: process.env.STANDALONE_BUILD ? 'standalone' : undefined,
  // Allow local network origins in development (e.g. mobile testing on LAN).
  allowedDevOrigins: ['10.10.127.126', 'localhost', '127.0.0.1'],
  // React Compiler memoises components at build time — cuts redundant
  // re-renders across the member UI without manual memo/useMemo churn.
  reactCompiler: true,
  async headers() {
    const security = [
      // no other site may frame the member app or the /cms admin (clickjacking)
      {
        key: 'Content-Security-Policy',
        value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
      },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    ]
    // non-production builds keep out of search results, static microsite pages included
    const headers = isIndexable()
      ? security
      : [...security, { key: 'X-Robots-Tag', value: 'noindex' }]
    return [
      { source: '/:path*', headers },
      // brand art and icons keep stable file names, so revalidate daily rather than per visit
      ...['/brand/:path*', '/icons/:path*'].map((source) => ({
        source,
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      })),
    ]
  },
  async redirects() {
    return [
      // the old landing-page preview; its links should still land somewhere
      { source: '/landingV2/:path*', destination: '/', permanent: true },
      // the retired consultation microsite: old links and the CMS footer still point here
      { source: '/consultation/:path*', destination: '/', permanent: true },
      // pages merged into /about/work and /about/organisation
      ...Object.entries(LEGACY_SITE_PATHS).map(([source, destination]) => ({
        source,
        destination,
        permanent: true,
      })),
    ]
  },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

// withPayload stays outermost (Payload requirement); Sentry only wraps the
// build for source-map upload when its auth token is configured.
export default withPayload(
  withSentryConfig(nextConfig, {
    silent: true,
    sourcemaps: { deleteSourcemapsAfterUpload: true },
  }),
  { devBundleServerPackages: false },
)
