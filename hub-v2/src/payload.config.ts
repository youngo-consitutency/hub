import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Accounts } from './collections/Accounts'
import { Assignments } from './collections/Assignments'
import { WorkingGroups } from './collections/WorkingGroups'
import { Events } from './collections/Events'
import { Announcements } from './collections/Announcements'
import { Submissions } from './collections/Submissions'
import { CouncilDecisions } from './collections/CouncilDecisions'
import { Coys } from './collections/Coys'
import { DirectoryContacts } from './collections/DirectoryContacts'
import { Resources } from './collections/Resources'
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
import {
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
} from './collections/misc'
import { domainEndpoints } from './endpoints'
// Negotiation tracking/contributions use the relational negotiation_* tables
// (migration-managed), not Payload collections — the source pipeline needs
// immutable version rows, join tables, and uuid identity.

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  routes: {
    admin: '/console',
  },
  collections: [
    Users,
    Media,
    Accounts,
    Assignments,
    MemberProfiles,
    WorkingGroups,
    WgProgress,
    Events,
    Announcements,
    Submissions,
    CouncilDecisions,
    Coys,
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

  ],
  endpoints: domainEndpoints,
  editor: lexicalEditor(),
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
