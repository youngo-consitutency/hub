import {
  TbBolt,
  TbCloudRain,
  TbCpu,
  TbCurrencyDollar,
  TbHeartHandshake,
  TbHeartRateMonitor,
  TbLeaf,
  TbPlant2,
  TbRipple,
  TbScale,
  TbSchool,
  TbShieldCheck,
  TbTarget,
  TbUsersGroup,
  TbWind,
} from 'react-icons/tb'

export const WORKING_GROUP_ICONS = {
  ace: TbSchool,
  adaptation: TbCloudRain,
  agriculture: TbPlant2,
  'conflict-of-interest': TbShieldCheck,
  coy: TbUsersGroup,
  energy: TbBolt,
  finance: TbCurrencyDollar,
  gender: TbScale,
  health: TbHeartRateMonitor,
  'human-rights': TbHeartHandshake,
  'loss-and-damage': TbRipple,
  mitigation: TbWind,
  nature: TbLeaf,
  ndcs: TbTarget,
  oceans: TbRipple,
  technology: TbCpu,
}

export function workingGroupIcon(slug) {
  return WORKING_GROUP_ICONS[slug] || TbUsersGroup
}
