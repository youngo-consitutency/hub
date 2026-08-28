import { useCallback, useEffect, useRef, useState } from 'react'
import {
  TbBell as Bell,
  TbBellOff as BellOff,
  TbBellRinging as BellRing,
  TbCircleCheck as CheckCircle2,
  TbHelpCircle as CircleHelp,
  TbInfoCircle as Info,
  TbDeviceLaptop as Laptop,
  TbDeviceMobile as Smartphone,
  TbDevices as TabletSmartphone,
  TbAlertTriangle as TriangleAlert,
  TbX as X,
} from 'react-icons/tb'
import { apiGet, apiPost } from '../lib/api.js'
import { currentDevice } from '../lib/device.js'
import {
  getPushSubscriptionStatus,
  isPushSupported,
  needsHomeScreenInstall,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from '../lib/pwa.js'
import { Button } from './ui.jsx'

const DEVICE_GUIDES = {
  ios: {
    title: 'iPhone or iPad',
    Icon: TabletSmartphone,
    steps: [
      'Open YOUNGO Hub in Safari.',
      'Choose Share, then Add to Home Screen.',
      'Open the Hub from its new icon and sign in.',
      'Return to Profile, turn notifications on, and choose Allow.',
    ],
    note: 'Web notifications require iOS or iPadOS 16.4 or later.',
  },
  android: {
    title: 'Android phone or tablet',
    Icon: Smartphone,
    steps: [
      'Open YOUNGO Hub in your browser. Installing it is optional.',
      'Open Profile and turn notifications on.',
      'Choose Allow when the browser asks.',
      'If alerts stop, check app notification and battery settings.',
    ],
    note: 'This permission applies only to the browser you are using now.',
  },
  desktop: {
    title: 'Laptop or desktop',
    Icon: Laptop,
    steps: [
      'Open Profile and turn notifications on.',
      'Choose Allow when the browser asks.',
      'Allow the browser in macOS or Windows notification settings too.',
      'Keep the browser running; the Hub tab may be closed.',
    ],
    note: 'Each browser has its own notification permission.',
  },
}

/**
 * Per-device notification control.
 *
 * A push subscription belongs to a browser, not to an account, so this reads
 * as "this device" throughout: a member who enables notifications on their
 * phone has not enabled them on the shared laptop in the delegation office.
 */
export function NotificationSettings() {
  const [state, setState] = useState({ loading: true })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [helpDevice, setHelpDevice] = useState(null)
  const helpDialogRef = useRef(null)
  const helpTriggerRef = useRef(null)

  const refresh = useCallback(async () => {
    const browser = await getPushSubscriptionStatus()
    let configured
    try {
      await apiGet('/push/vapid-key')
      configured = true
    } catch (fetchError) {
      // 503 is the server saying it holds no VAPID keys — a deployment
      // setting, not something the member did wrong. Any other failure is
      // treated as "reachable", so a flaky network does not hide the control.
      configured = fetchError.status !== 503
    }
    setState({ loading: false, configured, ...browser })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (helpDevice && !helpDialogRef.current?.open) {
      helpDialogRef.current?.showModal()
    }
  }, [helpDevice])

  const enable = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const permission = await requestNotificationPermission()
      if (!permission.granted) {
        setError(
          permission.error === 'Permission denied'
            ? 'Notifications are blocked for this site. Allow them in your device settings, then try again.'
            : 'Notifications were not allowed on this device.',
        )
        return
      }
      const { publicKey } = await apiGet('/push/vapid-key')
      const result = await subscribeToPush(publicKey)
      if (!result.success) {
        setError(result.error || 'Could not turn notifications on.')
        return
      }
      setMessage('Notifications are on for this device.')
      await refresh()
    } catch (thrown) {
      setError(thrown.message)
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await unsubscribeFromPush()
      if (!result.success) {
        setError(result.error || 'Could not turn notifications off.')
        return
      }
      setMessage('Notifications are off for this device.')
      await refresh()
    } catch (thrown) {
      setError(thrown.message)
    } finally {
      setBusy(false)
    }
  }

  const sendTest = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await apiPost('/push/test', {
        title: 'YOUNGO Hub',
        body: 'Notifications are working on this device.',
      })
      setMessage('Test sent — it should appear within a few seconds.')
    } catch (thrown) {
      setError(thrown.message)
    } finally {
      setBusy(false)
    }
  }

  const supported = !state.loading && isPushSupported()
  const installFirst = !state.loading && needsHomeScreenInstall()
  const blocked = state.permission === 'denied'
  const openHelp = () => setHelpDevice(currentDevice())
  const closeHelp = () => helpDialogRef.current?.close()

  return (
    <section
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
              className={`chip ${state.subscribed ? 'chip-accent' : 'chip-neutral'}`}
            >
              {state.subscribed ? 'On' : 'Off'}
            </span>
            <button
              ref={helpTriggerRef}
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
              {state.subscribed ? <BellRing size={20} /> : <Bell size={20} />}
            </span>
            <div className="notificationHeadingCopy">
              <h2>Alerts on this device</h2>
              <p className="meta">
                Deadlines, calls starting, and announcements the team pins —
                delivered even when the Hub is closed.
              </p>
            </div>
          </div>

          {message && (
            <p
              className="notificationNotice notificationNoticeOk"
              role="status"
            >
              <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden />
              {message}
            </p>
          )}
          {error && (
            <p
              className="notificationNotice notificationNoticeWarn"
              role="alert"
            >
              <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
              {error}
            </p>
          )}

          {/* Exactly one of these. Stacking, say, "not configured on the server"
                with "unblock it in your settings" sends a member off to fix
                something on their phone that was never the problem. */}
          {!supported ? (
            <p className="meta notificationHint">
              This browser cannot show web notifications. Chrome, Edge, Firefox,
              and Safari 16.4 or later all can.
            </p>
          ) : !state.configured ? (
            <p className="meta notificationHint">
              Notifications are not switched on for this Hub deployment yet. The
              admin team enables them once the server keys are in place.
            </p>
          ) : installFirst ? (
            <p className="meta notificationHint">
              Add the Hub to your iPhone or iPad Home Screen before turning
              alerts on. Use the help button above for the steps.
            </p>
          ) : blocked ? (
            <p className="meta notificationHint">
              Notifications are blocked in this device’s settings. Use the help
              button above to allow them again.
            </p>
          ) : (
            <div className="rowGap notificationActions">
              {state.subscribed ? (
                <>
                  <Button variant="secondary" onClick={disable} disabled={busy}>
                    <BellOff size={16} strokeWidth={1.75} aria-hidden />
                    Turn off
                  </Button>
                  <Button variant="ghost" onClick={sendTest} disabled={busy}>
                    Send a test
                  </Button>
                </>
              ) : (
                <Button variant="primary" onClick={enable} disabled={busy}>
                  <Bell size={16} strokeWidth={1.75} aria-hidden />
                  Turn on notifications
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {helpDevice && (
        <NotificationGuide
          device={helpDevice}
          dialogRef={helpDialogRef}
          onClose={closeHelp}
          onClosed={() => {
            setHelpDevice(null)
            helpTriggerRef.current?.focus()
          }}
        />
      )}
    </section>
  )
}

function NotificationGuide({ device, dialogRef, onClose, onClosed }) {
  const guide = DEVICE_GUIDES[device] || DEVICE_GUIDES.desktop
  const GuideIcon = guide.Icon

  return (
    <dialog
      ref={dialogRef}
      className="notificationHelpDialog"
      aria-labelledby="notification-help-title"
      onClose={onClosed}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="notificationGuideHeader">
        <span className="iconTile" aria-hidden>
          <GuideIcon size={21} strokeWidth={1.75} />
        </span>
        <div>
          <p className="pageEyebrow">Detected device</p>
          <h2 id="notification-help-title">{guide.title}</h2>
        </div>
        <button
          type="button"
          className="iconButton"
          aria-label="Close notification help"
          onClick={onClose}
        >
          <X size={18} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <ol className="notificationGuideSteps">
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <aside className="notificationDeviceNote">
        <Info size={17} strokeWidth={1.75} aria-hidden />
        <p className="meta">
          {guide.note} Setup is separate on every browser and device.
        </p>
      </aside>
    </dialog>
  )
}
