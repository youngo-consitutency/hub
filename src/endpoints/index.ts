import { publicEndpoints } from './public'
import { authEndpoints } from './auth'
import { memberEndpoints } from './member'
import { staffEndpoints } from './staff'
import { contentEndpoints } from './content'
import { ngoEndpoints } from './ngo'
import { resourceEndpoints } from './resources'
import { negotiationEndpoints } from './negotiations'
import { consultationEndpoints } from './consultation'
import { pushEndpoints } from './push'
import { notificationEndpoints } from './notifications'
import { intelligenceEndpoints } from './intelligence'
import { platformEndpoints } from './platform'
import { decisionEndpoints } from './decisions'
import { electionEndpoints, selectionEndpoints } from './governance'
import { membershipEndpoints } from './membership'
import { operationEndpoints } from './operations'

export const domainEndpoints = [
  ...authEndpoints,
  ...publicEndpoints,
  ...memberEndpoints,
  ...staffEndpoints,
  ...contentEndpoints,
  ...ngoEndpoints,
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
