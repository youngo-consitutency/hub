import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { defaultEmailFrom } from './lib/env'
import { emailConfigured, getEmailTransport } from './lib/email'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Accounts } from './collections/Accounts'
import { Appointments } from './collections/Appointments'
import { Assignments } from './collections/Assignments'
import { WorkingGroups } from './collections/WorkingGroups'
import { Events } from './collections/Events'
import { Announcements } from './collections/Announcements'
import { Submissions } from './collections/Submissions'
import { Coys } from './collections/Coys'
import { ContentDocuments } from './collections/ContentDocuments'
import { DirectoryContacts } from './collections/DirectoryContacts'
import { Resources, ResourceIssues, ResourceReviews } from './collections/Resources'
import { Opportunities } from './collections/Opportunities'
import { FeedbackTickets } from './collections/FeedbackTickets'
import { MemberProfiles } from './collections/MemberProfiles'
import {
  GysCycles,
  GysContributions,
  GysWorkflowCycles,
  GysTrackedContributions,
} from './collections/Gys'
import { WgProgress } from './collections/WgProgress'
import { WgActivities } from './collections/WgActivities'
import { CpCallSlots } from './collections/CpCallSlots'
import { ContentDrafts } from './collections/ContentDrafts'
import { ConsultationContributions } from './collections/ConsultationContributions'
import { PasswordResets } from './collections/PasswordResets'
import { NgoSeats, NgoRequests } from './collections/Ngo'
import { MembershipAppeals } from './collections/Membership'
import {
  NotificationPrefs,
  EmailVerificationTokens,
  PushSubscriptions,
  NotificationOutbox,
} from './collections/Notifications'
import { AuditLog } from './collections/Audit'
import { ResearchNotes } from './collections/Intelligence'
import {
  DecisionProposals,
  DecisionFlags,
  DecisionComments,
  DecisionBallots,
  DecisionVetoes,
  DecisionEvents,
} from './collections/Decisions'
import {
  Elections,
  ElectionCandidates,
  ElectionVoters,
  ElectionBallots,
  Selections,
  SelectionCommittee,
  SelectionApplications,
  SelectionEvaluations,
} from './collections/Governance'
import { Handovers } from './collections/Handovers'
import {
  FundingRequests,
  SafeguardingCases,
  CoiDeclarations,
  RecognitionRequests,
  PartnershipRequests,
  PrivacyRequests,
} from './collections/Operations'
import { domainEndpoints } from './endpoints'
// Negotiation tracking/contributions use the relational negotiation_* tables
// (migration-managed), not Payload collections — the source pipeline needs
// immutable version rows, join tables, and uuid identity.

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  // No admin UI: the generated page routes are deleted, so the console does
  // not exist. Staff operations run through the Payload local API (scripts,
  // terminal sessions) and direct database access; `users` stays only as the
  // auth collection that backs isStaff access checks.
  collections: [
    Users,
    Media,
    Accounts,
    Appointments,
    Assignments,
    MemberProfiles,
    WorkingGroups,
    WgProgress,
    Events,
    Announcements,
    Submissions,
    Coys,
    ContentDocuments,
    DirectoryContacts,
    Resources,
    Opportunities,
    FeedbackTickets,
    GysCycles,
    GysContributions,
    GysWorkflowCycles,
    GysTrackedContributions,
    WgActivities,
    CpCallSlots,
    ContentDrafts,
    ConsultationContributions,
    PasswordResets,
    NgoSeats,
    NgoRequests,
    MembershipAppeals,
    NotificationPrefs,
    AuditLog,
    PushSubscriptions,
    NotificationOutbox,
    ResourceIssues,
    ResourceReviews,
    ResearchNotes,
    EmailVerificationTokens,
    DecisionProposals,
    DecisionFlags,
    DecisionComments,
    DecisionBallots,
    DecisionVetoes,
    DecisionEvents,
    Elections,
    ElectionCandidates,
    ElectionVoters,
    ElectionBallots,
    Selections,
    SelectionCommittee,
    SelectionApplications,
    SelectionEvaluations,
    Handovers,
    FundingRequests,
    SafeguardingCases,
    CoiDeclarations,
    RecognitionRequests,
    PartnershipRequests,
    PrivacyRequests,
  ],
  endpoints: domainEndpoints,
  editor: lexicalEditor(),
  // Payload's own emails (staff password resets, verifications) share the
  // app's SMTP settings via the nodemailer adapter. Demo mode keeps a no-op
  // adapter so nothing leaves the environment; without SMTP config the
  // default adapter logs messages, which suits local development.
  email:
    process.env.HUB_DEMO_MODE === 'true'
      ? () => ({
          name: 'demo-disabled',
          defaultFromAddress: defaultEmailFrom(),
          defaultFromName: 'YOUNGO Hub',
          sendEmail: async () => undefined,
        })
      : emailConfigured()
        ? nodemailerAdapter({
            defaultFromAddress: process.env.EMAIL_FROM || defaultEmailFrom(),
            defaultFromName: 'YOUNGO Hub',
            transport: getEmailTransport()!,
          })
        : undefined,
  // Canonical origin for generated links (emails). Cross-site cookie
  // requests are already blocked by SameSite=Lax on the session cookie.
  serverURL: process.env.APP_BASE_URL || undefined,
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // Schema is managed exclusively through SQL migrations — never push.
    push: false,
    migrationDir: path.resolve(dirname, 'db/migrations'),
  }),
  sharp,
  plugins: [],
})
