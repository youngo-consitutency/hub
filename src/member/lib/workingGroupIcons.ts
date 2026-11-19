import {
  TbBolt,
  TbBuildingCommunity,
  TbCloudRain,
  TbCpu,
  TbCurrencyDollar,
  TbDroplet,
  TbHeartHandshake,
  TbHeartRateMonitor,
  TbLeaf,
  TbMask,
  TbMicroscope,
  TbPlant2,
  TbRipple,
  TbScale,
  TbSchool,
  TbShieldCheck,
  TbTarget,
  TbTransform,
  TbUsersGroup,
  TbWind,
} from 'react-icons/tb'
import type { IconType } from 'react-icons'

const WORKING_GROUP_ICONS: Record<string, IconType> = {
  ace: TbSchool,
  ach: TbMask,
  adaptation: TbCloudRain,
  agriculture: TbPlant2,
  cities: TbBuildingCommunity,
  'child-rights': TbHeartHandshake,
  'conflict-of-interest': TbShieldCheck,
  coy: TbUsersGroup,
  energy: TbBolt,
  finance: TbCurrencyDollar,
  gender: TbScale,
  health: TbHeartRateMonitor,
  'human-rights': TbHeartHandshake,
  'just-transition': TbTransform,
  'loss-and-damage': TbRipple,
  migration: TbUsersGroup,
  mitigation: TbWind,
  nature: TbLeaf,
  ndcs: TbTarget,
  oceans: TbRipple,
  'peace-and-security': TbShieldCheck,
  science: TbMicroscope,
  technology: TbCpu,
  water: TbDroplet,
}

export function workingGroupIcon(slug: string): IconType {
  return WORKING_GROUP_ICONS[slug] ?? TbUsersGroup
}
