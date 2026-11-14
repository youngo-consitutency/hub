import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { Body, Button, Container, Html, Link, Section, Text, render } from '@react-email/components'
import { emailPlainText, sanitizeEmailHtml } from './emailHtml'
import type { Doc, AnyValue } from './domain'

// Server-only email templates. JSX escapes every value; member HTML is the one
// raw insert, and it goes through sanitizeEmailHtml first.

const GREEN = '#087f5b'

// sanitised member markup gets inline styles, since email clients drop stylesheets
const EMAIL_TAG_STYLE: Record<string, string> = {
  p: 'font-size:15px;line-height:1.6;color:#14251d;margin:0 0 12px',
  h2: 'font-size:20px;line-height:1.3;color:#14251d;margin:18px 0 8px',
  h3: 'font-size:17px;line-height:1.3;color:#14251d;margin:16px 0 6px',
  ul: 'font-size:15px;line-height:1.6;color:#14251d;margin:0 0 12px;padding-left:20px',
  ol: 'font-size:15px;line-height:1.6;color:#14251d;margin:0 0 12px;padding-left:20px',
  blockquote: `border-left:3px solid ${GREEN};margin:0 0 12px;padding:0 0 0 12px;color:#3b4a43`,
  a: `color:${GREEN}`,
}

const s = {
  body: { margin: 0, padding: 0, background: '#f2f6f3', fontFamily: 'Arial,Helvetica,sans-serif' },
  container: { maxWidth: '600px', width: '100%' },
  bar: { background: GREEN, height: '8px', fontSize: 0, lineHeight: 0 },
  card: { background: '#ffffff', padding: '32px 28px 20px' },
  eyebrow: {
    color: GREEN,
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    margin: '0 0 4px',
  },
  title: {
    color: '#14251d',
    fontSize: '28px',
    lineHeight: 1.2,
    fontWeight: 700,
    margin: '0 0 14px',
  },
  paragraph: { fontSize: '16px', lineHeight: 1.6, color: '#24342d', margin: '0 0 14px' },
  button: {
    display: 'inline-block',
    background: GREEN,
    color: '#ffffff',
    borderRadius: '8px',
    fontWeight: 700,
    padding: '12px 22px',
    textDecoration: 'none',
  },
  social: { fontSize: '13px', lineHeight: 1.6, color: '#65736d', margin: '8px 0 0' },
  footer: { textAlign: 'center', fontSize: '12px', lineHeight: 1.5, color: '#65736d', margin: 0 },
} satisfies Record<string, CSSProperties>

const singleLine = (value: AnyValue, max = 160) =>
  String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, max)

const safeUrl = (value: AnyValue) => {
  const text = String(value || '').trim()
  if (!text) return null
  try {
    const url = new URL(text)
    if (!['https:', 'http:'].includes(url.protocol)) return null
    return url.toString()
  } catch {
    return null
  }
}

const paragraphs = (value: AnyValue) =>
  String(value || '')
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, i) => (
      <Text key={i} style={s.paragraph}>
        {item.split('\n').flatMap((line, j) => (j ? [<br key={j} />, line] : [line]))}
      </Text>
    ))

type Content = { subject: string; eyebrow: string; title: string; body: ReactNode; text: string }

function templateContent(templateKey: string, data: Doc = {}): Content {
  // unsafe action links are left out of the text version too
  const actionUrl = safeUrl(data.actionUrl)
  const link = actionUrl ? `\n\n${actionUrl}` : ''
  if (templateKey === 'password-reset') {
    return {
      subject: 'Reset your YOUNGO Hub password',
      eyebrow: 'Account security',
      title: 'Reset your password',
      body: paragraphs(
        'A password reset was requested for your YOUNGO Hub account. Use the button below within one hour.\n\nIf you did not request this, you can ignore this email.',
      ),
      text: `A password reset was requested for your YOUNGO Hub account. Use this link within one hour:${link}\n\nIf you did not request this, you can ignore this email.`,
    }
  }

  if (templateKey === 'verify-email') {
    return {
      subject: 'Verify your email for YOUNGO Hub updates',
      eyebrow: 'Email preferences',
      title: 'Verify your email address',
      body: paragraphs(
        'Confirm that this address belongs to you before enabling optional YOUNGO Hub email. The link expires after 24 hours.\n\nNo digest, deadline alert, or announcement will be sent until you enable it in your Profile.',
      ),
      text: `Verify your email address for YOUNGO Hub updates:${link}\n\nThe link expires after 24 hours. Optional email remains off until you enable it in your Profile.`,
    }
  }

  if (templateKey === 'invitation') {
    return {
      subject: 'You have been invited to YOUNGO Hub',
      eyebrow: 'Organisation invitation',
      title: 'Join an organisation team in YOUNGO Hub',
      body: paragraphs(
        `You have been invited to join an organisation team with the ${String(data.seatRole || 'representative')} role. Sign in with this same email address before accepting.\n\nThe invitation link expires after seven days and can be used once.`,
      ),
      text: `You have been invited to join an organisation team in YOUNGO Hub with the ${String(data.seatRole || 'representative')} role. Sign in with this same email address, then open this link within seven days:${link}`,
    }
  }

  if (templateKey === 'membership-activated') {
    const firstName = singleLine(data.firstName || 'there', 40)
    // staff-edited links, but still no javascript: hrefs
    const social: { label: string; url: string }[] = (
      Array.isArray(data.socialLinks) ? data.socialLinks : []
    ).filter((link: AnyValue) => safeUrl(link?.url))
    const socialText = social.map((link) => `${link.label}: ${link.url}`).join('\n')
    return {
      subject: 'Welcome — your YOUNGO membership is active',
      eyebrow: 'YOUNGO membership',
      title: `${firstName}, you are in`,
      body: (
        <>
          {paragraphs(
            `The Membership Team has activated your YOUNGO Hub membership.\n\nYOUNGO is the children and youth constituency to the UN climate process. The Hub is where members find working groups, calls, and the work happening now.\n\nA good next step is to open the Hub, join a working group, and build your avatar on your profile.`,
          )}
          {social.length > 0 && (
            <Text style={s.social}>
              Stay in touch
              <br />
              {social.map((link, i) => (
                <Fragment key={i}>
                  {i > 0 && ' \u00a0·\u00a0 '}
                  <Link
                    href={safeUrl(link.url)!}
                    style={{ color: GREEN, fontWeight: 700, textDecoration: 'none' }}
                  >
                    {link.label}
                  </Link>
                </Fragment>
              ))}
            </Text>
          )}
        </>
      ),
      text: `${firstName}, you are in.\n\nThe Membership Team has activated your YOUNGO Hub membership. Open the Hub to join a working group and build your avatar on your profile.${link}${socialText ? `\n\nStay in touch\n${socialText}` : ''}`,
    }
  }

  const title = singleLine(data.title || 'YOUNGO Hub update')
  if (data.html) {
    // member-written mail: sanitised again here, whatever the caller stored
    return {
      subject: title,
      eyebrow: data.eyebrow ? singleLine(data.eyebrow, 80) : 'Group mail',
      title,
      body: (
        <div dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(data.html, EMAIL_TAG_STYLE) }} />
      ),
      text: `${title}\n\n${emailPlainText(data.html)}${link}`,
    }
  }
  const message = String(data.message || '').slice(0, 4000)
  const labels: Record<string, string> = {
    announcement: 'Announcement',
    digest: 'Your weekly digest',
    deadline: 'Deadline reminder',
    'group-mail': 'Group mail',
  }
  return {
    subject: title,
    eyebrow: labels[templateKey] || 'YOUNGO Hub',
    title,
    body: paragraphs(message),
    text: `${title}\n\n${message}${link}`,
  }
}

export async function renderEmailTemplate(
  templateKey: string,
  data: Doc = {},
  { unsubscribeUrl = null }: { unsubscribeUrl?: string | null } = {},
) {
  const content = templateContent(templateKey, data)
  const actionUrl = safeUrl(data.actionUrl)
  const unsubscribe = unsubscribeUrl ? safeUrl(unsubscribeUrl) : null

  const html = await render(
    <Html>
      <Body style={s.body}>
        <Container style={s.container}>
          <Section style={s.bar}>&nbsp;</Section>
          <Section style={s.card}>
            <Text style={s.eyebrow}>{content.eyebrow}</Text>
            <Text style={s.title}>{content.title}</Text>
            {content.body}
            {actionUrl && (
              <Text style={{ margin: '18px 0 0' }}>
                <Button href={actionUrl} style={s.button}>
                  {singleLine(data.actionLabel || 'Open YOUNGO Hub', 80)}
                </Button>
              </Text>
            )}
          </Section>
          <Section style={{ padding: '18px 28px' }}>
            <Text style={s.footer}>
              {unsubscribe ? (
                <>
                  You received this because you enabled this category in YOUNGO Hub.{' '}
                  <Link href={unsubscribe} style={{ color: GREEN, textDecoration: 'underline' }}>
                    Unsubscribe from this category
                  </Link>
                  .
                </>
              ) : (
                'This account message was sent by YOUNGO Hub.'
              )}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>,
  )

  return {
    subject: content.subject,
    html,
    text: `${content.text}${unsubscribe ? `\n\nUnsubscribe from this category: ${unsubscribe}` : ''}`,
  }
}
