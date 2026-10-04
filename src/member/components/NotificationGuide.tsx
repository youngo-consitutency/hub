interface NotificationGuideProps {
  device?: AnyValue
  onClose?: AnyValue
}

import type { AnyValue } from '../lib/types'
import { SidePanel } from './SidePanel.tsx'
import {
  TbInfoCircle as Info,
  TbDeviceLaptop as Laptop,
  TbDeviceMobile as Smartphone,
  TbDevices as TabletSmartphone,
  TbShare2 as Share,
} from 'react-icons/tb'

export const DEVICE_GUIDES = {
  ios: {
    title: 'iPhone or iPad',
    Icon: TabletSmartphone,
    steps: [
      'Tap Share — the square with the arrow pointing up, at the bottom of Safari.',
      'Scroll the sheet and tap Add to Home Screen, then Add.',
      'Open the Hub from the new icon on your Home Screen and sign in.',
      'Tap Turn on alerts on this page and choose Allow.',
    ],
    note: 'Web notifications require iOS or iPadOS 16.4 or later. Safari cannot do this from a tab.',
  },
  android: {
    title: 'Android phone or tablet',
    Icon: Smartphone,
    steps: [
      'Tap Install app if your browser offers it. Installing is optional.',
      'Tap Turn on alerts on this page.',
      'Choose Allow when the browser asks.',
      'If alerts stop, check app notification and battery settings.',
    ],
    note: 'This permission applies only to the browser you are using now.',
  },
  desktop: {
    title: 'Laptop or desktop',
    Icon: Laptop,
    steps: [
      'Tap Turn on alerts on this page.',
      'Choose Allow when the browser asks.',
      'Allow the browser in macOS or Windows notification settings too.',
      'Keep the browser running; the Hub tab may be closed.',
    ],
    note: 'Each browser has its own notification permission.',
  },
}

export function NotificationGuide({ device, onClose }: NotificationGuideProps) {
  const guide = (DEVICE_GUIDES as AnyValue)[device] || DEVICE_GUIDES.desktop
  const GuideIcon = guide.Icon

  return (
    <SidePanel title="Notification setup" onClose={onClose}>
      <div className="notificationGuideHeader">
        <span className="iconTile" aria-hidden>
          <GuideIcon size={21} strokeWidth={1.75} />
        </span>
        <div>
          <p className="pageEyebrow">Detected device</p>
          <h2 id="notification-help-title">{guide.title}</h2>
        </div>
      </div>
      <ol className="notificationGuideSteps">
        {guide.steps.map((step: AnyValue, index: number) => (
          <li key={step}>
            {device === 'ios' && index === 0 && <Share size={16} strokeWidth={1.75} aria-hidden />}
            {step}
          </li>
        ))}
      </ol>
      <aside className="notificationDeviceNote">
        <Info size={17} strokeWidth={1.75} aria-hidden />
        <p className="meta">{guide.note} Setup is separate on every browser and device.</p>
      </aside>
    </SidePanel>
  )
}
