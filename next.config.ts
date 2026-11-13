import { withPayload } from '@payloadcms/next/withPayload'
import { withSentryConfig } from '@sentry/nextjs/config'
import type { NextConfig } from 'next'
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
  // non-production builds keep out of search results, static microsite pages included
  async headers() {
    if (isIndexable()) return []
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] }]
  },
  async redirects() {
    return [
      // the old landing-page preview; its links should still land somewhere
      { source: '/landingV2/:path*', destination: '/', permanent: true },
      // the retired consultation microsite: old links and the CMS footer still point here
      { source: '/consultation/:path*', destination: '/', permanent: true },
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
