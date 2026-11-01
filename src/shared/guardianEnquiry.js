/**
 * Safeguarding stop for under-18 membership.
 *
 * Choosing Under 18 does not open the normal application and does not create
 * an account. A parent or legal guardian may send a separate request. That
 * request stores only the fields listed in GUARDIAN_FIELDS.
 */

export const GUARDIAN_ENQUIRY_RETENTION_MONTHS = 12

export const UNDER18_STOP_MESSAGE =
  'People under 18 cannot complete this application. A parent or legal guardian has to use the guardian pathway. Nothing from this form is saved as a membership application.'

export const GUARDIAN_RELATIONSHIPS = [
  { value: 'parent', label: 'Parent' },
  { value: 'legal_guardian', label: 'Legal guardian' },
]

export const GUARDIAN_CONSENT_STATEMENT =
  'I am the parent or legal guardian. I am asking the YOUNGO Membership Team to contact me about membership for a person under 18. I understand this form does not collect that person’s application.'

/** Shown on the pathway and recorded in the privacy notice. */
export const GUARDIAN_FIELDS = [
  {
    id: 'guardianName',
    label: 'Guardian name',
    why: 'So the Membership Team knows which adult is taking responsibility.',
  },
  {
    id: 'guardianEmail',
    label: 'Guardian email',
    why: 'So the next step goes to the adult, not to a young person.',
  },
  {
    id: 'relationship',
    label: 'Parent or legal guardian',
    why: 'So the request records that it comes from someone claiming that responsibility.',
  },
  {
    id: 'guardianAuthority',
    label: 'Confirmation',
    why: 'So there is a record that the adult, not the young person, asked the team to make contact.',
  },
]

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const RELATIONSHIP_VALUES = new Set(GUARDIAN_RELATIONSHIPS.map((item) => item.value))

export function retentionCutoff(now = new Date()) {
  const cutoff = new Date(now.getTime())
  cutoff.setMonth(cutoff.getMonth() - GUARDIAN_ENQUIRY_RETENTION_MONTHS)
  return cutoff
}

/**
 * Validate a guardian pathway request.
 * Child application fields on the body are ignored and are not returned.
 */
export function validateGuardianEnquiry(body) {
  const b = body || {}
  if (b.hpWebsite || b.website) return { honeypot: true }

  /** @type {Record<string, string>} */
  const fields = {}
  const guardianName = String(b.guardianName || '')
    .trim()
    .replace(/\s+/g, ' ')
  const guardianEmail = String(b.guardianEmail || '')
    .trim()
    .toLowerCase()
  const relationship = String(b.relationship || '').trim()
  const guardianAuthority = b.guardianAuthority === true

  if (!guardianName) fields.guardianName = 'Enter the guardian’s full name.'
  else if (guardianName.length > 200) fields.guardianName = 'Guardian name is too long.'
  if (!EMAIL_RE.test(guardianEmail) || guardianEmail.length > 160) {
    fields.guardianEmail = 'Enter the guardian’s email address.'
  }
  if (!RELATIONSHIP_VALUES.has(relationship)) {
    fields.relationship = 'Say whether you are the parent or the legal guardian.'
  }
  if (!guardianAuthority) {
    fields.guardianAuthority = 'The parent or legal guardian has to confirm this request.'
  }
  if (Object.keys(fields).length) return { fields }

  return {
    data: {
      guardianName,
      guardianEmail,
      relationship,
      consentStatement: GUARDIAN_CONSENT_STATEMENT,
      consentedAt: new Date().toISOString(),
    },
  }
}
