import type { AnyValue } from '../lib/types'
import { useEffect, useRef, useState } from 'react'
import {
  TbBell as Bell,
  TbBellOff as BellOff,
  TbBellRinging as BellRing,
  TbCircleCheck as CheckCircle2,
  TbHelpCircle as CircleHelp,
  TbDeviceMobile as Smartphone,
  TbPlus as Plus,
  TbShare2 as Share,
  TbAlertTriangle as TriangleAlert,
} from 'react-icons/tb'
import { currentDevice } from '../lib/device'
import { isPushSupported } from '../lib/pwa'
import { useAlertSetup } from '../lib/useAlertSetup'
import { DEVICE_GUIDES, NotificationGuide } from './NotificationGuide'
import { Button } from './ui'

export { DEVICE_GUIDES, NotificationGuide }

/**
 * Per-device notification control.
 *
 * A push subscription belongs to a browser, not to an account, so this reads
 * as "this device" throughout: a member who enables notifications on their
 * phone has not enabled them on the shared laptop in the delegation office.
 */
export function NotificationSettings() {
  const setup = useAlertSetup()
  const [helpDevice, setHelpDevice] = useState<AnyValue>(null)
  const cardRef = useRef<AnyValue>(null)

  useEffect(() => {
    if (window.location.hash !== '#alerts') return
    cardRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  const { state, busy, message, error } = setup
  const supported = !state.loading && isPushSupported()
  const installFirst = setup.installFirst
  const blocked = setup.blocked
  const openHelp = () => setHelpDevice(currentDevice())
  const closeHelp = () => setHelpDevice(null)

  return (
    <section
      ref={cardRef}
      id="alerts"
      className="card notificationCard"
      aria-label="Notification settings"
    >
      {state.loading ? (
        <p className="meta notificationHint" role="status">
          Checking notification support on this device…
        </p>
      ) : (
        <>
          <div className="notificationStatusActions">
            <span
              className={`chip ${(state as AnyValue).subscribed ? 'chip-accent' : 'chip-neutral'}`}
            >
              {(state as AnyValue).subscribed ? 'On' : 'Off'}
            </span>
            <button
              type="button"
              className="iconButton notificationHelpTrigger"
              aria-label="How to turn on notifications on this device"
              aria-haspopup="dialog"
              onClick={openHelp}
            >
              <CircleHelp size={19} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          <div className="notificationHeadingRow">
            <span className="iconTile" aria-hidden>
              {(state as AnyValue).subscribed ? <BellRing size={20} /> : <Bell size={20} />}
            </span>
            <div className="notificationHeadingCopy">
              <h2>Alerts on this device</h2>
              <p className="meta">
                Deadlines, calls starting, and announcements the team pins — delivered even when the
                Hub is closed.
              </p>
            </div>
          </div>

          {message && (
            <p className="notificationNotice notificationNoticeOk" role="status">
              <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden />
              {message}
            </p>
          )}
          {error && (
            <p className="notificationNotice notificationNoticeWarn" role="alert">
              <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
              {error}
            </p>
          )}

          {/* Exactly one of these. Stacking, say, "not configured on the server"
                with "unblock it in your settings" sends a member off to fix
                something on their phone that was never the problem. */}
          {!supported ? (
            <p className="meta notificationHint">
              This browser cannot show web notifications. Chrome, Edge, Firefox, and Safari 16.4 or
              later all can.
            </p>
          ) : !(state as AnyValue).configured ? (
            <p className="meta notificationHint">
              Notifications are not switched on for this Hub deployment yet. The admin team enables
              them once the server keys are in place.
            </p>
          ) : installFirst ? (
            <div className="notificationInstall">
              <p className="meta notificationHint">
                iPhone and iPad only deliver alerts from the Home Screen app, not from a Safari tab.
                Follow these taps:
              </p>
              <ol className="notificationInstallSteps">
                {DEVICE_GUIDES.ios.steps.map((step, index) => (
                  <li key={step}>
                    {index === 0 && <Share size={16} strokeWidth={1.75} aria-hidden />}
                    {step}
                  </li>
                ))}
              </ol>
              <div className="rowGap notificationActions">
                <Button variant="primary" onClick={openHelp}>
                  <Smartphone size={16} strokeWidth={1.75} aria-hidden />
                  Show me where to tap
                </Button>
              </div>
            </div>
          ) : blocked ? (
            <p className="meta notificationHint">
              Notifications are blocked in this device’s settings. Use the help button above to
              allow them again.
            </p>
          ) : (
            <div className="rowGap notificationActions">
              {(state as AnyValue).subscribed ? (
                <>
                  <Button variant="secondary" onClick={setup.disable} disabled={busy}>
                    <BellOff size={16} strokeWidth={1.75} aria-hidden />
                    Turn off
                  </Button>
                  <Button variant="ghost" onClick={setup.sendTest} disabled={busy}>
                    Send a test
                  </Button>
                </>
              ) : (
                <>
                  {setup.installAvailable && (
                    <Button variant="secondary" onClick={setup.install} disabled={busy}>
                      <Plus size={16} strokeWidth={1.75} aria-hidden />
                      Install app
                    </Button>
                  )}
                  <Button variant="primary" onClick={setup.enable} disabled={busy}>
                    <Bell size={16} strokeWidth={1.75} aria-hidden />
                    Turn on alerts
                  </Button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {helpDevice && <NotificationGuide device={helpDevice} onClose={closeHelp} />}
    </section>
  )
}
