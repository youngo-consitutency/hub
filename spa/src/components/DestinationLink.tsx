interface DestinationIconProps {
  url?: string
  size?: any
  className?: string
  [key: string]: any
}

interface ExternalResourceRowProps {
  href?: string
  label?: string
  meta?: string | null
  className?: string
}

import {
  TbArrowUpRight,
  TbBrandAirtable,
  TbBrandDiscord,
  TbBrandFacebook,
  TbBrandGithub,
  TbBrandGoogle,
  TbBrandGoogleDrive,
  TbBrandInstagram,
  TbBrandLinkedin,
  TbBrandLinktree,
  TbBrandNotion,
  TbBrandOffice,
  TbBrandTelegram,
  TbBrandTiktok,
  TbBrandWhatsapp,
  TbBrandX,
  TbBrandYoutube,
  TbBrandZoom,
  TbCalendar,
  TbFileText,
  TbForms,
  TbGlobe,
  TbMail,
  TbMap,
  TbSlideshow,
  TbTable,
  TbVideo,
} from 'react-icons/tb'

// Exact host or a true subdomain — 'app.zoom.us' matches, 'notzoom.us'
// does not.
const hostIs = (host: any, domain: any) => host === domain || host.endsWith(`.${domain}`)

export function destinationIconFor(rawUrl = '') {
  if (/^mailto:/i.test(rawUrl)) return TbMail

  let url
  try {
    url = new URL(rawUrl)
  } catch {
    return TbGlobe
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  const path = url.pathname.toLowerCase()

  if (hostIs(host, 'instagram.com')) return TbBrandInstagram
  if (hostIs(host, 'linkedin.com')) return TbBrandLinkedin
  if (hostIs(host, 'whatsapp.com')) return TbBrandWhatsapp
  if (hostIs(host, 'facebook.com')) return TbBrandFacebook
  if (hostIs(host, 'youtube.com') || host === 'youtu.be') return TbBrandYoutube
  if (hostIs(host, 'twitter.com') || host === 'x.com') return TbBrandX
  if (hostIs(host, 'github.com')) return TbBrandGithub
  if (hostIs(host, 't.me') || hostIs(host, 'telegram.me')) {
    return TbBrandTelegram
  }
  if (hostIs(host, 'discord.com') || hostIs(host, 'discord.gg')) {
    return TbBrandDiscord
  }
  if (hostIs(host, 'tiktok.com')) return TbBrandTiktok
  if (host === 'linktr.ee') return TbBrandLinktree
  if (hostIs(host, 'airtable.com')) return TbBrandAirtable
  if (host === 'drive.google.com') return TbBrandGoogleDrive
  if (host === 'calendar.app.google' || host === 'calendar.google.com') {
    return TbCalendar
  }
  if (host === 'meet.google.com') return TbVideo
  if (hostIs(host, 'zoom.us')) return TbBrandZoom
  if (hostIs(host, 'notion.site') || host === 'notion.so') {
    return TbBrandNotion
  }
  if (hostIs(host, 'mailchi.mp') || hostIs(host, 'mailchimp.com')) {
    return TbMail
  }
  if (hostIs(host, 'openstreetmap.org')) return TbMap
  if (hostIs(host, 'microsoft.com') || hostIs(host, 'office.com') || hostIs(host, 'outlook.com')) {
    return TbBrandOffice
  }
  if (host === 'outlook.live.com') return TbBrandOffice

  if (host === 'docs.google.com') {
    if (path.startsWith('/forms/')) return TbForms
    if (path.startsWith('/spreadsheets/')) return TbTable
    if (path.startsWith('/presentation/')) return TbSlideshow
    return TbFileText
  }

  if (host === 'forms.gle') return TbForms
  if (hostIs(host, 'google.com')) return TbBrandGoogle
  if (path.endsWith('.pdf')) return TbFileText
  return TbGlobe
}

export function DestinationIcon({
  url,
  size = 18,
  className = '',
  ...props
}: DestinationIconProps) {
  const Icon = destinationIconFor(url)
  return <Icon className={className} size={size} aria-hidden focusable="false" {...props} />
}

export function ExternalResourceRow({
  href,
  label,
  meta,
  className = '',
}: ExternalResourceRowProps) {
  return (
    <a
      href={href}
      className={`resourceRow destinationResourceRow ${className}`.trim()}
      target="_blank"
      rel="noopener noreferrer"
    >
      <DestinationIcon url={href} className="destinationResourceIcon" size={20} />
      <strong>{label}</strong>
      {meta && <span className="metaMuted destinationResourceMeta">{meta}</span>}
      <TbArrowUpRight
        className="destinationResourceAction"
        size={16}
        strokeWidth={1.75}
        aria-hidden
      />
    </a>
  )
}
