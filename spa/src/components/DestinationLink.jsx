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
  TbCloudComputing,
  TbFileText,
  TbForms,
  TbGlobe,
  TbMail,
  TbMap,
  TbSlideshow,
  TbTable,
  TbVideo,
} from 'react-icons/tb'

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

  if (host.endsWith('instagram.com')) return TbBrandInstagram
  if (host.endsWith('linkedin.com')) return TbBrandLinkedin
  if (host.endsWith('whatsapp.com')) return TbBrandWhatsapp
  if (host.endsWith('facebook.com')) return TbBrandFacebook
  if (host.endsWith('youtube.com') || host === 'youtu.be') return TbBrandYoutube
  if (host.endsWith('twitter.com') || host === 'x.com') return TbBrandX
  if (host.endsWith('github.com')) return TbBrandGithub
  if (host.endsWith('t.me') || host.endsWith('telegram.me')) {
    return TbBrandTelegram
  }
  if (host.endsWith('discord.com') || host.endsWith('discord.gg')) {
    return TbBrandDiscord
  }
  if (host.endsWith('tiktok.com')) return TbBrandTiktok
  if (host === 'linktr.ee') return TbBrandLinktree
  if (host.endsWith('airtable.com')) return TbBrandAirtable
  if (host === 'drive.google.com') return TbBrandGoogleDrive
  if (host === 'calendar.app.google' || host === 'calendar.google.com') {
    return TbCalendar
  }
  if (host === 'meet.google.com') return TbVideo
  if (host.endsWith('zoom.us')) return TbBrandZoom
  if (host.endsWith('notion.site') || host === 'notion.so') {
    return TbBrandNotion
  }
  if (host.endsWith('mailchi.mp') || host.endsWith('mailchimp.com')) {
    return TbMail
  }
  if (host.endsWith('openstreetmap.org')) return TbMap
  if (host.endsWith('railway.com')) return TbCloudComputing
  if (
    host.endsWith('microsoft.com') ||
    host.endsWith('office.com') ||
    host.endsWith('outlook.com') ||
    host.endsWith('outlook.live.com') ||
    host.endsWith('outlook.office.com')
  ) {
    return TbBrandOffice
  }

  if (host === 'docs.google.com') {
    if (path.startsWith('/forms/')) return TbForms
    if (path.startsWith('/spreadsheets/')) return TbTable
    if (path.startsWith('/presentation/')) return TbSlideshow
    return TbFileText
  }

  if (host === 'forms.gle') return TbForms
  if (host.endsWith('google.com')) return TbBrandGoogle
  if (path.endsWith('.pdf')) return TbFileText
  return TbGlobe
}

export function DestinationIcon({ url, size = 18, className = '', ...props }) {
  const Icon = destinationIconFor(url)
  return (
    <Icon
      className={className}
      size={size}
      aria-hidden
      focusable="false"
      {...props}
    />
  )
}

export function ExternalResourceRow({ href, label, meta, className = '' }) {
  return (
    <a
      href={href}
      className={`resourceRow destinationResourceRow ${className}`.trim()}
      target="_blank"
      rel="noopener noreferrer"
    >
      <DestinationIcon
        url={href}
        className="destinationResourceIcon"
        size={20}
      />
      <strong>{label}</strong>
      {meta && (
        <span className="metaMuted destinationResourceMeta">{meta}</span>
      )}
      <TbArrowUpRight
        className="destinationResourceAction"
        size={16}
        strokeWidth={1.75}
        aria-hidden
      />
    </a>
  )
}
