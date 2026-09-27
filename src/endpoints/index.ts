import { publicEndpoints } from './public'
import { authEndpoints } from './auth'
import { memberEndpoints } from './member'
import { staffEndpoints } from './staff'
import { contentEndpoints } from './content'
import { ngoEndpoints } from './ngo'
import { resourceEndpoints } from './resources'
import { negotiationEndpoints } from './negotiations'
import { miscEndpoints } from './misc'
import { platformEndpoints } from './platform'
import { decisionEndpoints } from './decisions'

export const domainEndpoints = [
  ...authEndpoints,
  ...publicEndpoints,
  ...memberEndpoints,
  ...staffEndpoints,
  ...contentEndpoints,
  ...ngoEndpoints,
  ...resourceEndpoints,
  ...negotiationEndpoints,
  ...miscEndpoints,
  ...platformEndpoints,
  ...decisionEndpoints,
]
