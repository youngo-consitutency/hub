import { publicEndpoints } from './public'
import { authEndpoints } from './auth'
import { memberEndpoints } from './member'
import { peopleEndpoints } from './people'
import { feedbackEndpoints } from './feedback'
import { adminEndpoints } from './admin'
import { membershipTeamEndpoints } from './membershipTeam'
import { gysEndpoints } from './gys'
import { contactPointEndpoints } from './contactPoints'
import { contentEndpoints } from './content'
import { opportunityEndpoints } from './opportunities'
import { ngoEndpoints } from './ngo'
import { organisationEndpoints } from './organisations'
import { resourceEndpoints } from './resources'
import { negotiationEndpoints } from './negotiations'
import { consultationEndpoints } from './consultation'
import { pushEndpoints } from './push'
import { notificationEndpoints } from './notifications'
import { intelligenceEndpoints } from './intelligence'
import { platformEndpoints } from './platform'
import { decisionEndpoints } from './decisions'
import { electionEndpoints } from './elections'
import { selectionEndpoints } from './selections'
import { membershipEndpoints } from './membership'
import { operationEndpoints } from './operations'

export const domainEndpoints = [
  ...authEndpoints,
  ...publicEndpoints,
  ...memberEndpoints,
  ...peopleEndpoints,
  ...feedbackEndpoints,
  ...opportunityEndpoints,
  ...adminEndpoints,
  ...membershipTeamEndpoints,
  ...gysEndpoints,
  ...contactPointEndpoints,
  ...contentEndpoints,
  ...ngoEndpoints,
  ...organisationEndpoints,
  ...resourceEndpoints,
  ...negotiationEndpoints,
  ...consultationEndpoints,
  ...pushEndpoints,
  ...notificationEndpoints,
  ...intelligenceEndpoints,
  ...platformEndpoints,
  ...decisionEndpoints,
  ...electionEndpoints,
  ...selectionEndpoints,
  ...membershipEndpoints,
  ...operationEndpoints,
]
