import type { Metadata, Viewport } from 'next'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'YOUNGO Hub',
  description:
    'YOUNGO Hub brings the work of the UNFCCC children and youth constituency into one shared platform — meetings, working groups, submissions, decisions, opportunities, and trusted knowledge.',
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
    <html lang="en">
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
