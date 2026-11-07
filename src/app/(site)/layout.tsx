import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { appBaseUrl } from '../../lib/env'
import { SITE_DESCRIPTION, SITE_NAME, isIndexable, shareMetadata } from './seo'

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl()),
  title: SITE_NAME,
  // only production is indexed; previews keep out of search results
  robots: !isIndexable() ? { index: false, follow: false } : undefined,
  description: SITE_DESCRIPTION,
  ...shareMetadata,
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/icons/favicon-32.png', type: 'image/png', sizes: '32x32' }],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'YOUNGO Hub',
  },
  other: {
    'msapplication-config': '/browserconfig.xml',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F5F9F6',
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before paint, matching the legacy index.html. */}
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  )
}
