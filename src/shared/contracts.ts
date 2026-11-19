import type { AvatarOptions } from './avatar'
import type { AccountView } from '../lib/domain'

// Response shapes shared by the API views (src/lib/content.ts, src/lib/views.ts) and the UI.
// Keep them in step with the view functions: the server builds these, the cards render them.

export interface WorkingGroupRef {
  slug: string
  name: string
}

export interface EventSummary {
  slug: string
  title: string
  type: string
  startsAt: string
  endsAt?: string | null
  meetingUrl?: string | null
  wg?: WorkingGroupRef | null
}

export interface SubmissionSummary {
  slug: string
  title: string
  status: string
  deadlineAt?: string | null
  contributeNote?: string | null
  wg?: WorkingGroupRef | null
}

/** An item on Home's "closing soon" list: a submission or a decision with a deadline. */
export interface ClosingItem {
  kind?: 'submission' | 'decision'
  slug: string
  title: string
  status: string
  deadlineAt?: string | null
}

export interface CoySummary {
  slug: string
  title: string
  type: string
  status: string
  region?: string | null
  city?: string | null
  country?: string | null
  startsOn?: string | null
  endsOn?: string | null
  datesTbc?: boolean
  organizerName?: string | null
}

export interface GroupSummary {
  slug: string
  name: string
  focusLine?: string | null
  cadenceNote?: string | null
  topic?: string | null
}

export interface AnnouncementSummary {
  slug: string
  title: string
  body: string
  pinned: boolean
  ctaUrl?: string | null
  ctaLabel?: string | null
  ctaDeadlineAt?: string | null
  publishedAt?: string | null
}

/** GET /api/feed: what Home shows (src/lib/feed.ts builds it). */
export interface FeedResponse {
  live: EventSummary | null
  pinned: AnnouncementSummary[]
  week: EventSummary[]
  closing: ClosingItem[]
  coys: CoySummary[]
  counts: { week: number; closing: number; coys: number }
}

/** One row of GET /api/member/workspace: the member's onboarding progress in a working group. */
export interface WorkspaceProgress {
  wg_slug: string
  presentation_ok?: boolean
  rules_ok?: boolean
}

/** One member in GET /api/member/people (src/lib/memberDirectory.ts safePerson). */
export interface PersonSummary {
  id: number
  displayName: string
  headline: string
  bio: string
  pronouns: string
  expertiseTags: string[]
  country: string | null
  region: string | null
  roleTitle: string | null
  contactRole: string | null
  organization: { name: string; seatRole?: string | null } | null
  workingGroups: (WorkingGroupRef & { role?: string })[]
  teams: { name: string }[]
  platformRole: string | null
  avatar: Record<string, unknown> | null
  updatedAt: string | null
}

export interface PeopleResponse {
  items: PersonSummary[]
}

/** One row of GET /api/negotiations (src/modules/negotiation/tracking.ts). */
export interface NegotiationTrackSummary {
  id: number
  slug: string
  topic: string
  summary: string | null
  activityStatus: string
  workingGroupSlugs: string[] | null
  openCalls: number
}

export interface NegotiationTracksResponse {
  items: NegotiationTrackSummary[]
  page: number
  pageSize: number
  total: number
}

/** One row of GET /api/member/opportunities (src/lib/content.ts opportunityShape). */
export interface OpportunitySummary {
  id: number
  organizationName: string
  kind: string
  title: string
  summary: string | null
  body?: string | null
  format: string
  location: string | null
  region: string | null
  startsAt: string | null
  endsAt: string | null
  deadlineAt: string | null
  linkUrl: string | null
}

/** An entry of a staff-editable vocabulary (the `content-options` document). */
export interface VocabOption {
  value: string
  label: string
  description?: string
}

/** The `content-options` document: every vocabulary the UI offers, editable at /cms. */
export interface ContentOptions {
  eventTypes?: VocabOption[]
  resourcePathways?: VocabOption[]
  resourceTypes?: VocabOption[]
  resourceTopics?: string[]
  resourceRegions?: VocabOption[]
  resourceLanguages?: string[]
  teamLabels?: VocabOption[]
  assignmentLabels?: VocabOption[]
  wgActivityKinds?: VocabOption[]
  resourceIssueKinds?: VocabOption[]
}

/** One row of GET /api/resources (src/lib/content.ts listResources). */
export interface ResourceSummary {
  slug: string
  title: string
  url: string
  summary: string | null
  publisher: string | null
  pathway: string | null
  type: string
  topics: string[]
  topic: string | null
  region: string | null
  language: string | null
  /** Where an imported resource came from; null for hand-added ones. */
  source: {
    repository: string
    commit: string
    path: string
    category: string
    subcategory: string
  } | null
  verification: {
    status: string
    checkedAt: string | null
    openIssues: number
  }
  fingerprint: string
}

/** A content draft in the review pipeline (src/endpoints/content.ts draftView). */
export interface ContentDraftView {
  id: number
  contentType: string
  contentKey: string
  payload: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- free-form per content type
  status: string
  createdBy: number | null
  creatorName: string | null
  reviewedBy: number | null
  reviewerName: string | null
  reviewNote: string | null
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  reviewedAt: string | null
  publishedAt: string | null
  revision: number
}

/** GET /api/member/content: the content studio's drafts, permissions and live items. */
export interface ContentWorkspaceResponse {
  permissions: { canDraft: boolean; canReview: boolean; canPublish: boolean }
  items: ContentDraftView[]
  publications: ContentDraftView[]
  groups: GroupSummary[]
  live: { events: EventSummary[]; announcements: AnnouncementSummary[] }
  pages: Record<string, unknown>[]
}

export interface DecisionSummary {
  slug: string
  title: string
  proposer?: string | null
  summary?: string | null
}

export interface ContactSummary {
  roleTitle: string
  description?: string | null
}

/** GET /api/search: the direct (non-AI) matches per kind (src/lib/content.ts search). */
export interface SearchResponse {
  events: EventSummary[]
  submissions: SubmissionSummary[]
  decisions: DecisionSummary[]
  coys: CoySummary[]
  groups: GroupSummary[]
  contacts: ContactSummary[]
}

export interface IntelligenceEvidence {
  evidenceId: string
  sourceType: string
  title: string
  snippet: string
  url: string
  /** Relevance, highest first; set on every returned row. */
  score?: number
}

/** POST /api/intelligence/query (src/endpoints/intelligence.ts). */
export interface IntelligenceResult {
  query: string
  audience: 'member' | 'operator'
  evidence: IntelligenceEvidence[]
  /** The evidence again, re-keyed E1, E2, … so bullets can cite by number. */
  citations: IntelligenceEvidence[]
  synthesis: {
    answer: string
    bullets: { text: string; citationIndexes: number[] }[]
    confidence: 'medium' | 'low' | 'none'
    caveat: string
  }
}

/** A proposed research note awaiting independent review (writebackView). */
export interface WritebackView {
  id: number
  kind: string
  title: string
  note: string | null
  status: string
  account: { id: number; name: string } | null
  approvedBy: number | null
  createdAt: string
}

/** GET /api/intelligence/metrics: research-note counts (the operator sees everyone's). */
export interface IntelligenceMetrics {
  notesTotal: number
  byStatus: Record<string, number>
  semanticEnabled: boolean
}

/** A seat in an organisation's team (src/lib/ngo.ts seatView). */
export interface NgoSeat {
  id: number
  orgAccountId: number
  memberAccountId: number | null
  email: string | null
  name: string | null
  seatRole: string
  status: string
  inviteExpiresAt: string | null
  createdAt: string
  acceptedAt: string | null
  memberName: string | null
  memberEmail: string | null
}

/** A logged request (raw `ngo_requests` row, so snake_case). */
export interface NgoRequest {
  id: number
  kind: string
  title: string
  body: string | null
  status: string
  deadline_at: string | null
}

/** GET /api/member/ngo/requests. */
export interface NgoRequestsResponse {
  items: NgoRequest[]
  seats: NgoSeat[]
  orgAccountId: string
  permissions: { seatRole: string; canWriteRequests: boolean; canManageSeats: boolean }
}

/** An open report against a resource. */
export interface ResourceIssue {
  id: number
  resourceSlug: string
  kind: string
  detail: string
  createdAt: string
}

/** The latest verification review of a resource. */
export interface ResourceReview {
  resourceSlug: string
  status: string
  note: string | null
  reviewedAt: string
  reviewerName: string | null
}

/** GET /api/member/resources/issues: the Content Publishers' verification queue. */
export interface ResourceIssuesResponse {
  items: ResourceSummary[]
  issues: ResourceIssue[]
  reviews: ResourceReview[]
  submissions: ContentDraftView[]
}

/** An organisation in the posting-trust list (GET /api/member/opportunities/review). */
export interface PostingOrganisation {
  orgAccountId: number
  organizationName: string | null
  trusted: boolean
  override: 'trusted' | 'review_required' | null
  overrideNote: string | null
}

export interface OpportunityReviewResponse {
  items: OpportunitySummary[]
  published: OpportunitySummary[]
  organisations: PostingOrganisation[]
}

/** A slide of the working-group onboarding deck (the `self-paced` content documents). */
export interface DeckSlide {
  id: string
  title: string
  kicker?: string
  layout?:
    'cover' | 'section' | 'split' | 'cards' | 'people' | 'rows' | 'months' | 'photos' | 'prose'
  body?: string[]
  points?: { label: string; text: string }[]
  links?: { href: string; label: string }[]
  months?: { name: string; text: string; ahead?: boolean }[]
  photos?: { src: string; alt: string }[]
}

export interface DeckBrand {
  label?: string
  [token: string]: string | undefined
}

export interface DeckCourse {
  slides: DeckSlide[]
  brand?: DeckBrand
}

/** The `privacy-notice` content document (editable at /cms). */
export interface PrivacyNoticeDoc {
  CONSENT_SUMMARY?: string[]
  CONSENT_STATEMENT?: string
  PRIVACY_VERSION?: string
  PRIVACY_META?: { contactEmail?: string }
}

/** The `membership-policy` content document. */
export interface MembershipPolicyDoc {
  POLICY_VERSION?: string
}

/** The `registration-options` content document: the choices on the sign-up forms. */
export interface RegistrationOptionsDoc {
  genders?: string[]
  regions?: string[]
  minorityOptions?: string[]
  ageBands?: VocabOption[]
  youthAffiliations?: VocabOption[]
}

/** The `policies` content document: where each policy lives. */
export interface PoliciesDoc {
  POLICY_BY_SLUG?: Record<string, { href?: string } | undefined>
  browseAllUrl?: string
}

/** The `connect` content document. */
export interface ConnectDoc {
  MEMBERSHIP_CONTACT_EMAIL?: string
  SOCIAL_LINKS?: SocialLink[]
}

export interface GysCount {
  label: string
  count: number
}

export interface GysContribution {
  id: number
  slug?: string
  title: string
  status: string
  theme?: string | null
  country?: string | null
  source?: string | null
  version?: number
  wg?: WorkingGroupRef | null
}

export interface GysSynthesisBullet {
  text: string
  theme?: string | null
  citations: { contributionId?: number; title: string }[]
}

/** GET /api/member/team/gys/overview: the GYS policy team's workspace. */
export interface GysOverview {
  current: { title?: string; tagline?: string; status?: string } | null
  process: { step: string; body: string }[]
  contributions: GysContribution[]
  statuses: string[]
  synthesis: {
    answer: string
    caveat?: string
    bullets?: GysSynthesisBullet[]
    counts?: {
      byTheme?: GysCount[]
      byRegion?: GysCount[]
      byCountry?: GysCount[]
      bySubmitterType?: GysCount[]
    }
  } | null
  formUrl: string | null
  submissions: SubmissionSummary[]
  decisions: DecisionSummary[]
}

/** A parsed CSV of member inputs, before import (POST /api/member/team/gys/inputs/preview). */
export interface GysImportPreview {
  rowCount: number
  columnMap?: { body?: string }
  preview: Record<string, unknown>[]
}

// Further response shapes shared by the API views and the member UI (see contracts.ts).

/** One of an organisation's own postings (src/lib/content.ts opportunityShape). */
export interface NgoOpportunityItem extends OpportunitySummary {
  status: string
  reviewNote: string | null
}

/** GET /api/member/ngo/opportunities. */
export interface NgoOpportunitiesResponse {
  items: NgoOpportunityItem[]
  trusted: boolean
  kinds: VocabOption[]
  formats: VocabOption[]
  canPost: boolean
}

/** A task force a working group publishes (src/shared/protocol.ts normalizeTaskForces). */
export interface TaskForce {
  slug: string
  name: string
  purpose: string
}

/** A working-group activity row (src/lib/views.ts wgActivityView, snake_case on the wire). */
export interface WgActivity {
  id: number
  kind: string
  title: string
  body?: string | null
  url?: string | null
  starts_at?: string | null
  ends_at?: string | null
  task_force_slug?: string | null
  wg_slug?: string
  // camelCase aliases some callers build; the card accepts either
  startsAt?: string | null
  endsAt?: string | null
  taskForceSlug?: string | null
}

/** GET /api/member/workspace/:wg. */
export interface WorkspaceResponse {
  progress: { presentation_ok?: boolean; rules_ok?: boolean } | null
  activities: WgActivity[]
}

/** A link on a group page (collection working-groups, `resources`). */
export interface GroupResourceLink {
  label: string
  url: string
  description?: string | null
  visibility?: string | null
}

/** A group with its working surface (src/lib/content.ts getGroup, after groupView). */
export interface GroupDetail extends GroupSummary {
  taskForces?: TaskForce[]
  events?: EventDetail[]
  submissions?: SubmissionDetail[]
  resources?: GroupResourceLink[]
  workspaceResourcesLocked?: boolean
}

/** An event with its briefing (src/lib/content.ts eventShape). */
export interface EventDetail extends EventSummary {
  description?: string | null
  recordingUrl?: string | null
}

/** A submission with its links (src/lib/content.ts submissionShape). */
export interface SubmissionDetail extends SubmissionSummary {
  description?: string | null
  draftUrl?: string | null
  finalUrl?: string | null
  unfcccUrl?: string | null
}

/** A conference with its organiser and links (collection coys). */
export interface CoyDetail extends CoySummary {
  registerUrl?: string | null
  websiteUrl?: string | null
  instagramUrl?: string | null
  statementUrl?: string | null
  organizerOrg?: string | null
  organizerEmail?: string | null
  applicationsCloseAt?: string | null
  liveOps?: boolean
}

/** One notice in GET /api/member/coy/:slug/notices. */
export interface CoyNotice {
  id: number
  title: string
  body: string
  channels: string[]
  createdAt: string
}

export interface CoyNoticesResponse {
  items: CoyNotice[]
  allowlisted: boolean
  organiser: boolean
}

export interface CoyAudienceSummary {
  participants: number
  emailEligible: number
  pushDevices: number
}

export interface CoyParticipant {
  accountId: string
  name: string | null
  email: string
  note: string | null
  createdAt: string
}

/** GET /api/member/coy/:slug/participants. */
export interface CoyParticipantsResponse {
  items: CoyParticipant[]
  summary: CoyAudienceSummary
}

/** POST /api/member/coy/:slug/participants. */
export interface CoyAddResult {
  added: number
  already: number
  missing: string[]
  inactive: string[]
}

/** POST /api/member/coy/:slug/announce (a replayed campaign returns only `ok`). */
export interface CoyAnnounceResult {
  ok: boolean
  notice?: CoyNotice | null
  email: { queued: number; eligible: number }
  push: { queued: number; devices: number }
}

/** A feedback ticket (collection feedback-tickets, as GET /api/member/feedback returns it). */
export interface FeedbackTicket {
  id: number
  title: string
  kind: string
  severity: string
  body: string
  status: string
  pageUrl?: string | null
  viewport?: string | null
  contactEmail?: string | null
  triageNote?: string | null
  githubIssueUrl?: string | null
  createdAt?: string
}

/** GET /api/member/feedback and /feedback/mine. */
export interface FeedbackTicketsResponse {
  items: FeedbackTicket[]
}

/** GET /api/member/feedback/options. */
export interface FeedbackOptionsResponse {
  kinds: VocabOption[]
  severities: VocabOption[]
  canTriage: boolean
}

/** GET /api/member/notifications/preferences. */
export interface NotificationPreferences {
  accountId: number | string
  timezone: string
  digestDay: number
  digestHourUtc: number
  /** Opt-in per category, keyed by category (digest, deadline, announcement, group_mail). */
  email: Record<string, boolean>
  emailVerified: boolean
  deliveryConfigured: boolean
  deliveryDisabled: boolean
}

/** The editable part of the preferences, as PATCH takes it and returns it. */
export type EmailPreferencesForm = Pick<
  NotificationPreferences,
  'timezone' | 'digestDay' | 'digestHourUtc' | 'email'
>

/** A section of the full Membership Policy text (staff-edited `membership-policy` document). */
export interface PolicySection {
  id: string
  heading: string
  paragraphs?: string[]
  bullets?: { label: string; items: string[] }[]
  paragraphsAfter?: string[]
}

/** The `membership-policy` document as the mandatory read renders it. */
export interface MembershipPolicyContent {
  POLICY_VERSION?: string
  MANDATE_ANALYSIS: { title: string; lede: string; points: { title: string; body: string }[] }
  POLICY_META: {
    name: string
    issue: string
    updatedOn: string
    contactEmail: string
    officialSource?: { href: string }
    translations: { lang: string; href: string }[]
  }
  POLICY_SECTIONS?: PolicySection[]
}

/** A Contact Point call slot with the people's emails (publicSlot withEmail in src/endpoints/contactPoints.ts). */
export interface AdminCpCallSlot {
  id: number
  startsAt: string
  durationMinutes: number | null
  meetUrl: string | null
  host: { id: number; name?: string; email?: string } | null
  bookedBy: { id: number; name?: string; email?: string } | null
  bookedAt: string | null
}

/** GET /api/member/admin/cp-calls/mine. */
export interface AdminCpCallSlotsResponse {
  slots: AdminCpCallSlot[]
}

/** POST /api/member/admin/notifications/preview: the rendered email (src/lib/emailTemplate.tsx). */
export interface EmailPreview {
  subject: string
  html: string
  text: string
}

/** POST /api/member/admin/notifications/send. */
export interface BroadcastResult {
  ok: boolean
  campaignId: string
  eligible: number
  queued: number
}

/** A directory contact (src/lib/content.ts listDirectory). `holders` is present for members only. */
export interface DirectoryContact {
  group?: string
  roleTitle: string
  description?: string | null
  publicEmail?: string | null
  wg?: WorkingGroupRef | null
  channelValue?: string | null
  holders?: { displayName?: string }[]
}

/** Response types added alongside contracts.ts by the typing pass. */

/** The member's own directory profile in GET /api/member/profile (src/endpoints/member.ts). */
export interface OwnProfile {
  accountId: number
  displayName: string
  headline: string
  bio: string
  pronouns: string
  expertiseTags: string[]
  directoryVisibility: string
  showCountry: boolean
  showOrganization: boolean
  showWorkingGroups: boolean
  showRoles: boolean
  roleTitle: string
  revision: number
  updatedAt: string | null
  avatar: AvatarOptions | null
}

/** GET /api/member/profile. */
export interface OwnProfileResponse {
  profile: OwnProfile
}

/** The full `membership-policy` content document (contracts.ts only types its version). */
export interface MembershipPolicyFullDoc {
  POLICY_VERSION?: string
  MANDATE_ANALYSIS: {
    title: string
    lede: string
    points: { title: string; body: string }[]
  }
  POLICY_META: {
    name: string
    issue: string
    updatedOn: string
    contactEmail: string
    officialSource?: { href: string }
    translations: { lang: string; href: string }[]
  }
  POLICY_SECTIONS: {
    id: string
    heading: string
    paragraphs?: string[]
    bullets?: { label: string; items: string[] }[]
    paragraphsAfter?: string[]
  }[]
}

/** One organisation in GET /api/member/organisations (src/endpoints/organisations.ts). */
export interface OrganisationOption {
  id: number
  name: string
  country: string | null
  isUnfcccAdmitted: boolean
}

/** One of the member's affiliations in GET /api/member/affiliations. */
export interface AffiliationSeat extends NgoSeat {
  organizationName: string | null
}

/** The `library` content document: published guides (editable at /cms). */
export interface LibraryDoc {
  sectionLabel?: string
  description?: string
  guides?: { title: string; href: string; body: string }[]
}

/** GET /api/push/admin/summary. */
export interface PushAdminSummary {
  configured: boolean
  accounts: number
  devices: number
}

/** One account with push devices, in GET /api/push/admin/subscribers. */
export interface PushSubscriberAccount {
  id: number
  email: string
  name: string
  devices: number
}

/** POST /api/push/send (202). */
export interface PushSendResult {
  ok: boolean
  campaignId: string
  targeted: number
  queued: number
}

/** Shared response and document types added alongside contracts.ts. */

export interface PrivacyDataCategory {
  id: string
  label: string
  fields: string[]
  purpose: string
  whoSees: string
}

export interface PrivacySection {
  id: string
  heading: string
  paragraphs?: string[]
  bullets?: { label: string; items: string[] }[]
  paragraphsAfter?: string[]
}

/** The full `privacy-notice` content document as the Privacy page renders it. */
export interface PrivacyNoticeFull {
  PRIVACY_VERSION?: string
  PRIVACY_META?: {
    name?: string
    status?: string
    effectiveFrom?: string
    contactEmail?: string
    relatedPolicies?: { slug: string; label: string }[]
    processors?: { name: string; href?: string; role: string }[]
  }
  PRIVACY_SECTIONS?: PrivacySection[]
  DATA_CATEGORIES?: PrivacyDataCategory[]
}

/** GET /api/member/admin/accounts: one page of the staff account list. */
export interface AdminAccountsResponse {
  items: AccountView[]
  total: number
  page: number
  pageSize: number
  pages: number
}

/** A governance audit row (the `audit-log` collection), as sent by GET /api/member/admin/audit. */
export interface AuditEntry {
  id: number
  action: string
  targetType?: string | null
  targetId?: string | null
  actorEmail?: string | null
  createdAt: string
}

/** POST /api/member/admin/accounts/:id/reset-link */
export interface AdminResetResult {
  ok: boolean
  expiresAt: string
  message: string
}

/** One working-group membership row from GET /api/member/cp/:wg/members, flattened client-side. */
export interface CpMemberProgress {
  wg_slug: string
  status: string
  role_in_wg: string
  joined_at?: string | null
  presentation_ok?: boolean
  rules_ok?: boolean
  unlocked_at?: string | null
}

export interface CpMembersResponse {
  members: {
    progress: CpMemberProgress
    /** id + name only: contact points never see members' profile data. */
    account: { id: number; name?: string } | null
  }[]
}

/** An icon card from the `site` content document; `icon` names a react-icons component held in the page. */
export interface SiteIconCard {
  icon: string
  title: string
  body: string
}

/** A labelled link from the `site` / `connect` content documents. */
export interface SiteLink {
  href: string
  label: string
}

export interface PublicPageSection {
  id: string
  title: string
  body: string
  linkLabel?: string | null
  linkUrl?: string | null
}

/** GET /api/pages/:slug: the reviewed FAQ or contact page (document is null once withdrawn). */
export interface PublicPageResponse {
  state: 'baseline' | 'published' | 'unpublished'
  revisionId: number | null
  publishedAt: string | null
  document: {
    slug: string
    title: string
    intro: string
    sections: PublicPageSection[]
  } | null
}

/** A route card on the contact section, from the reviewed page or the site document baseline. */
export interface ContactRoute {
  icon?: string
  title: string
  body: string
  cta: { label?: string | null; href: string; internal?: boolean; external?: boolean } | null
}

/** An official social channel from the `connect` content document. */
export interface SocialLink {
  key: string
  label: string
  url: string
}

/** GET /api/gys: the current Global Youth Statement cycle (src/lib/content.ts getGys). */
export interface GysPublicResponse {
  current: {
    year?: number | null
    edition?: string | null
    title: string
    location?: string | null
    targetSession?: string | null
    intro?: string | null
    note?: string | null
    fullUrl?: string | null
    inputsUrl?: string | null
    inputsDeadlineAt?: string | null
    releaseUrl?: string | null
  }
  priorities: { title: string; body?: string; group?: string }[]
  process: { step: string; body: string }[]
  archive: {
    edition: string
    year: number | string
    host?: string
    links: { label: string; url: string }[]
  }[]
}

/** A working group as listed on the public site (GET /api/groups), with its topic tags. */
export interface PublicGroup {
  slug: string
  name: string
  focusLine?: string | null
  topic?: string | null
  tags?: string[]
}

export interface DirectoryTopic {
  key: string
  label: string
}

/** GET /api/landing */
export interface LandingResponse {
  events: { slug: string; title: string; startsAt: string }[]
}

/** GET /api/member/course (the answer key is never sent). */
export interface CourseResponse {
  version: string
  passScore: number
  modules: { title: string; minutes?: number; body: string[] }[]
  quiz: { id: string; prompt: string; choices: { id: string; text: string }[] }[]
  accountStatus?: string
  alreadyPassed: boolean
}

/** POST /api/member/course/submit when the quiz is passed (a failure is a 400 error). */
export interface CourseSubmitResponse {
  ok: boolean
  score: number
  total: number
  passed: boolean
  account: AccountView
}

/** A Contact Point call slot (publicSlot in src/endpoints/contactPoints.ts). */
export interface CpCallSlotView {
  id: number
  startsAt: string
  durationMinutes: number | null
  meetUrl: string | null
  host: { id: number; name?: string } | null
  bookedBy: { id: number; name?: string } | null
  bookedAt: string | null
}

/** GET /api/member/cp-calls/slots. `mine` holds the caller's own booking, if any (at most one). */
export interface CpCallSlotsResponse {
  slots: CpCallSlotView[]
  mine: CpCallSlotView[]
}

export interface NegotiationAgendaItem {
  id: string
  body: string
  session: string
  item: string
  subItem: string | null
  title: string
  lineageFrom: string[]
}

export interface NegotiationDocumentSummary {
  id: string
  title: string
  sourceIdentifier: string | null
  sourceUrl: string
  documentStatus: string
  statusVerified: boolean
  versionCount: number
  latestVersion: {
    id: string
    contentHash: string
    language: string
    originalReference: string | null
    publishedAt: string | null
    retrievedAt: string
    extraction: {
      method: string | null
      version: string | null
      /** A pg numeric column, so it may arrive as a string. */
      confidence: number | string | null
    }
  }
  health: {
    lastSuccessfulCheckAt: string | null
    lastAttemptAt: string | null
    lastAttemptStatus: string | null
    coverageState: string
    safeDiagnostic: string | null
  }
}

export interface NegotiationCall {
  id: string
  title: string
  mandate: string | null
  eligibility: string | null
  submittingChannel: string | null
  status: string
  sourceVersionId: string | null
  externalDeadline: {
    date: string | null
    precision: string | null
    time?: string | null
    timezone?: string | null
  }
}

/** GET /api/negotiations/:slug (getPublicTrack in src/modules/negotiation/tracking.ts). */
export interface NegotiationTrackDetail {
  id: number
  slug: string
  topic: string
  summary: string | null
  activityStatus: string
  agendaItems: NegotiationAgendaItem[]
  documents: NegotiationDocumentSummary[]
  calls: NegotiationCall[]
}

/** A row of GET /api/negotiations/projects. */
export interface SubmissionProjectRow {
  id: string
  title: string
  purpose: string
  isInitiative: boolean
  lifecycleStatus: string
  currentVersion: number
  updatedAt: string
  track: { slug: string; topic: string }
}

export interface SubmissionCitation {
  sourceVersionId: string
  location?: { page?: string; paragraph?: string } | null
  quote?: string | null
}

export interface SubmissionProjectVersion {
  id: string
  version: number
  baseVersionId: string | null
  contentText: string
  contentHash: string
  externalSnapshotUrl: string | null
  authoredBy: string | null
  createdAt: string
  citations: SubmissionCitation[]
}

export interface SubmissionProjectAmendment {
  id: string
  targetType: string
  targetDocumentVersionId: string | null
  targetProjectVersionId: string | null
  stableAnchor: unknown
  operation: string
  originalText: string | null
  proposedText: string | null
  rationale: string | null
  decisionStatus: string
  reconciliationStatus: string
  authorId: string | null
  currentVersion: number
  createdAt: string
  updatedAt: string
}

/** GET /api/negotiations/projects/:id, wrapped as `{ project }`. */
export interface SubmissionProjectDetail {
  id: string
  title: string
  purpose: string
  isInitiative: boolean
  lifecycleStatus: string
  currentVersion: number
  workingGroupSlug: string | null
  intendedSubmittingEntity: string | null
  externalDraftUrl: string | null
  track: { id: number; slug: string; topic: string }
  call: { id: string; title: string } | null
  versions: SubmissionProjectVersion[]
  amendments: SubmissionProjectAmendment[]
}

/** One band of the contact pyramid in the `directory` content document. */
export interface DirectoryLayer {
  id: string
  level: string | number
  eyebrow?: string
  title: string
  description?: string
  /** The contact `group` values shown in this band. */
  groups: string[]
}

/** A member's progress row for one working group (wgProgressView in src/endpoints/member.ts). */
export interface WgProgressView {
  account_id?: number | string
  wg_slug?: string
  presentation_ok?: boolean
  rules_ok?: boolean
  unlocked_at?: string | null
  joined_at?: string | null
  status?: string
  role_in_wg?: string
}

/** The group record the workspace page reads: the detail view plus its channel and contact. */
export interface WorkspaceGroup extends GroupDetail {
  whatsappUrl?: string | null
  contact?: ContactSummary
}

/** A public link found in an organisation's website or social text. */
export interface MembershipApplicationLink {
  href: string
  host: string
}

/** The registration answers the Membership Team reviews (membershipReviewAccount). */
export interface MembershipApplication {
  firstName?: string | null
  lastName?: string | null
  email?: string
  phone?: string | null
  gender?: string | null
  genderOther?: string | null
  dateOfBirth?: string | null
  ageBand?: string | null
  entityType?: string
  membershipTrack?: string | null
  countryOfResidence?: string | null
  region?: string | null
  nationality?: string | null
  motivation?: string | null
  minorityIdentity?: boolean
  minorityGroups?: string[]
  minorityOther?: string | null
  memberOfAccreditedNgo?: boolean | string | null
  organizationName?: string | null
  organizationType?: string | null
  isUnfcccAdmitted?: boolean
  youthAffiliation?: string | null
  orgWebsite?: string | null
  orgSocial?: string | null
  orgMission?: string | null
  orgOperateIn?: string | null
  under18?: boolean
  guardianName?: string | null
  guardianEmail?: string | null
  guardianConsent?: boolean | string | null
  dcpName?: string | null
  dcpEmail?: string | null
  dcpPhone?: string | null
  ycpName?: string | null
  ycpEmail?: string | null
  ycpPhone?: string | null
  acceptCodeOfConduct?: boolean | string | null
  acceptDataProtection?: boolean | string | null
  acceptPrinciples?: boolean | string | null
  acceptCoiPolicy?: boolean | string | null
  policiesAccepted?: boolean | string | null
  membershipPolicyVersion?: string | null
  privacyConsent?: boolean | string | null
  privacyNoticeVersion?: string | null
  privacyConsentAt?: string | null
  coiDeclared?: boolean | string | null
  coiDetails?: string | null
  links?: MembershipApplicationLink[]
}

/** The latest membership appeal for an account (publicAppeal in src/lib/membershipAppeals.ts). */
export interface MembershipAppealView {
  id: string | number
  accountId: number | null
  status: string
  identityKind: string | null
  statement: string | null
  proofContentType: string | null
  proofByteSize: number
  submittedAt: string
  reviewedAt: string | null
  reviewerNote: string | null
}

/** A row of GET /api/member/team/membership/overview. */
export interface MembershipReviewItem extends AccountView {
  application: MembershipApplication
  profile?: {
    displayName: string
    headline: string
    expertiseTags: string[]
    directoryVisibility: string
    avatar: unknown
    updatedAt: string | null
  }
  appeal: MembershipAppealView | null
}

/** An under-18 guardian request (guardianEnquiries view). */
export interface GuardianEnquiryView {
  id: number
  guardianName: string
  guardianEmail: string
  relationship: string
  consentStatement: string
  consentedAt: string
  createdAt: string
}

export interface MembershipOverviewResponse {
  items: MembershipReviewItem[]
  guardianEnquiries?: GuardianEnquiryView[]
}

/** A person credited on the Help page, from the `connect` content document. */
export interface HubLauncher {
  name: string
  focus?: string
}

/** GET /api/member/focal/overview (src/endpoints/member.ts). */
export interface FocalOverviewResponse {
  events: EventSummary[]
  submissions: SubmissionSummary[]
  decisions: (DecisionSummary & { status: string })[]
  groups: GroupSummary[]
  mandateContacts: DirectoryContact[]
}
