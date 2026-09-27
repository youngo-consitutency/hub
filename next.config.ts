import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  // Dockerfile and other self-hosted targets consume the standalone output.
  // Vercel and `next start` need the default output, so standalone is opt-in.
  output: process.env.STANDALONE_BUILD ? 'standalone' : undefined,
  async rewrites() {
    return [
      // Static consultation microsite lives in public/consultation/ — legacy
      // URLs /consultation and /consultation/recap must resolve to it rather
      // than the member SPA.
      { source: '/consultation', destination: '/consultation/index.html' },
      { source: '/consultation/recap', destination: '/consultation/recap.html' },
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

export default withPayload(nextConfig, { devBundleServerPackages: false })
