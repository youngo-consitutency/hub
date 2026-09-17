import mjml2html from 'mjml'
import { publishedLinks } from '../../../src/content/connect.js'

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function singleLine(value, max = 160) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, max)
}

function safeUrl(value) {
  const text = String(value || '').trim()
  if (!text) return null
  try {
    const url = new URL(text)
    if (!['https:', 'http:'].includes(url.protocol)) return null
    return escapeHtml(url.toString())
  } catch {
    return null
  }
}

function paragraphs(value) {
  return String(value || '')
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(
      (item) =>
        `<mj-text font-size="16px" line-height="1.6" color="#24342d">${escapeHtml(item).replaceAll('\n', '<br />')}</mj-text>`,
    )
    .join('\n')
}

function templateContent(templateKey, data) {
  const actionUrl = safeUrl(data.actionUrl)
  const actionLabel = escapeHtml(
    singleLine(data.actionLabel || 'Open YOUNGO Hub', 80),
  )
  const action = actionUrl
    ? `<mj-button href="${actionUrl}" background-color="#087f5b" color="#ffffff" border-radius="8px" font-weight="700">${actionLabel}</mj-button>`
    : ''

  if (templateKey === 'password-reset') {
    return {
      subject: 'Reset your YOUNGO Hub password',
      eyebrow: 'Account security',
      title: 'Reset your password',
      body: paragraphs(
        'A password reset was requested for your YOUNGO Hub account. Use the button below within one hour.\n\nIf you did not request this, you can ignore this email.',
      ),
      action,
      text: `A password reset was requested for your YOUNGO Hub account. Use this link within one hour:\n\n${data.actionUrl}\n\nIf you did not request this, you can ignore this email.`,
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
      action,
      text: `Verify your email address for YOUNGO Hub updates:\n\n${data.actionUrl}\n\nThe link expires after 24 hours. Optional email remains off until you enable it in your Profile.`,
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
      action,
      text: `You have been invited to join an organisation team in YOUNGO Hub with the ${String(data.seatRole || 'representative')} role. Sign in with this same email address, then open this link within seven days:\n\n${data.actionUrl}`,
    }
  }

  if (templateKey === 'membership-activated') {
    const firstName = singleLine(data.firstName || 'there', 40)
    const social = publishedLinks()
    const socialHtml = social
      .map(
        (link) =>
          `<a href="${escapeHtml(link.url)}" style="color:#087f5b;font-weight:700;text-decoration:none">${escapeHtml(link.label)}</a>`,
      )
      .join(' &nbsp;·&nbsp; ')
    const socialText = social
      .map((link) => `${link.label}: ${link.url}`)
      .join('\n')
    return {
      subject: 'Welcome — your YOUNGO membership is active',
      eyebrow: 'YOUNGO membership',
      title: `${firstName}, you are in`,
      body: `${paragraphs(
        `The Membership Team has activated your YOUNGO Hub membership.\n\nYOUNGO is the children and youth constituency to the UN climate process. The Hub is where members find working groups, calls, and the work happening now.\n\nA good next step is to open the Hub, join a working group, and add a photo on your profile.`,
      )}
            ${
              socialHtml
                ? `<mj-text font-size="13px" line-height="1.6" color="#65736d" padding-top="8px">Stay in touch<br />${socialHtml}</mj-text>`
                : ''
            }`,
      action,
      text: `${firstName}, you are in.\n\nThe Membership Team has activated your YOUNGO Hub membership. Open the Hub to join a working group and add a photo on your profile.${data.actionUrl ? `\n\n${data.actionUrl}` : ''}${socialText ? `\n\nStay in touch\n${socialText}` : ''}`,
    }
  }

  const title = singleLine(data.title || 'YOUNGO Hub update')
  const message = String(data.message || '').slice(0, 4000)
  const labels = {
    announcement: 'Announcement',
    digest: 'Your weekly digest',
    deadline: 'Deadline reminder',
  }
  return {
    subject: title,
    eyebrow: labels[templateKey] || 'YOUNGO Hub',
    title,
    body: paragraphs(message),
    action,
    text: `${title}\n\n${message}${data.actionUrl ? `\n\n${data.actionUrl}` : ''}`,
  }
}

export async function renderEmailTemplate(
  templateKey,
  data = {},
  { unsubscribeUrl = null } = {},
) {
  const content = templateContent(templateKey, data)
  const unsubscribe = safeUrl(unsubscribeUrl)
  const footer = unsubscribe
    ? `<mj-text align="center" font-size="12px" line-height="1.5" color="#65736d">You received this because you enabled this category in YOUNGO Hub. <a href="${unsubscribe}" style="color:#087f5b">Unsubscribe from this category</a>.</mj-text>`
    : `<mj-text align="center" font-size="12px" line-height="1.5" color="#65736d">This account message was sent by YOUNGO Hub.</mj-text>`

  const source = `
    <mjml>
      <mj-head>
        <mj-title>${escapeHtml(content.subject)}</mj-title>
        <mj-preview>${escapeHtml(content.title)}</mj-preview>
        <mj-attributes>
          <mj-all font-family="Arial, Helvetica, sans-serif" />
        </mj-attributes>
      </mj-head>
      <mj-body background-color="#f2f6f3" width="600px">
        <mj-section background-color="#087f5b" padding="8px 0"></mj-section>
        <mj-section background-color="#ffffff" padding="32px 28px 20px">
          <mj-column>
            <mj-text color="#087f5b" font-size="12px" font-weight="700" letter-spacing="1px" text-transform="uppercase">${escapeHtml(content.eyebrow)}</mj-text>
            <mj-text color="#14251d" font-size="28px" line-height="1.2" font-weight="700" padding-top="4px">${escapeHtml(content.title)}</mj-text>
            ${content.body}
            ${content.action}
          </mj-column>
        </mj-section>
        <mj-section padding="18px 28px">
          <mj-column>
            ${footer}
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>`

  const rendered = await mjml2html(source, { validationLevel: 'strict' })
  if (rendered.errors?.length) {
    throw new Error(`Email template is invalid: ${rendered.errors[0].message}`)
  }
  return {
    subject: content.subject,
    html: rendered.html,
    text: `${content.text}${unsubscribe ? `\n\nUnsubscribe from this category: ${unsubscribeUrl}` : ''}`,
  }
}
