import { useCallback, useEffect, useState } from 'react'
import {
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  Share,
  Smartphone,
  TriangleAlert,
} from 'lucide-react'
import { apiGet, apiPost } from '../lib/api.js'
import {
  getPushSubscriptionStatus,
  isIOS,
  isPushSupported,
  needsHomeScreenInstall,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from '../lib/pwa.js'
import { Button, Section } from './ui.jsx'

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

  if (state.loading) return null

  const supported = isPushSupported()
  const installFirst = needsHomeScreenInstall()
  const blocked = state.permission === 'denied'

  return (
    <Section label="Notifications">
      <div className="card">
        <div className="rowGap notificationHeadingRow">
          <span className="iconTile" aria-hidden>
            {state.subscribed ? <BellRing size={20} /> : <Bell size={20} />}
          </span>
          <div className="notificationHeadingCopy">
            <h3>Alerts on this device</h3>
            <p className="meta">
              Deadlines, calls starting, and announcements the team pins —
              delivered even when the Hub is closed.
            </p>
          </div>
          <span
            className={`chip ${state.subscribed ? 'chip-accent' : 'chip-neutral'}`}
          >
            {state.subscribed ? 'On' : 'Off'}
          </span>
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
            This browser cannot show web notifications. Chrome, Edge, Firefox,
            and Safari 16.4 or later all can.
          </p>
        ) : !state.configured ? (
          <p className="meta notificationHint">
            Notifications are not switched on for this Hub deployment yet. The
            admin team enables them once the server keys are in place.
          </p>
        ) : installFirst ? (
          <IPhoneInstall />
        ) : blocked ? (
          <BlockedHelp />
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
      </div>

      <DeviceInstructions />
    </Section>
  )
}

/**
 * iOS refuses Web Push to a page open in a Safari tab. The site has to be on
 * the Home Screen and opened from that icon first. Members hit this constantly,
 * so the steps are shown in place of a button that could not work.
 */
function IPhoneInstall() {
  return (
    <div className="notificationInstall">
      <p className="notificationInstallLead">
        <Smartphone size={16} strokeWidth={1.75} aria-hidden />
        On iPhone and iPad, add the Hub to your Home Screen first — Apple only
        allows notifications from an installed app.
      </p>
      <ol className="notificationSteps">
        <li>
          Open this page in <strong>Safari</strong> (not Chrome or in-app
          browsers — Apple only offers the install there).
        </li>
        <li>
          Tap the <strong>Share</strong> button
          <Share
            size={14}
            strokeWidth={1.75}
            aria-hidden
            className="notificationInlineIcon"
          />
          at the bottom of the screen.
        </li>
        <li>
          Scroll down and tap <strong>Add to Home Screen</strong>, then{' '}
          <strong>Add</strong>.
        </li>
        <li>
          Close Safari and open <strong>YOUNGO Hub</strong> from the new Home
          Screen icon.
        </li>
        <li>
          Sign in, come back to this page, and tap{' '}
          <strong>Turn on notifications</strong>, then <strong>Allow</strong>.
        </li>
      </ol>
      <p className="metaMuted">
        Needs iOS 16.4 or later. Check under Settings › General › About ›
        Software Version.
      </p>
    </div>
  )
}

/** Recovery path once the browser permission prompt has been refused. */
function BlockedHelp() {
  return (
    <div className="notificationInstall">
      <p className="notificationInstallLead">
        <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
        Notifications are blocked for the Hub on this device. The browser will
        not ask again until you allow them in settings.
      </p>
      <ol className="notificationSteps">
        {isIOS() ? (
          <>
            <li>
              Open <strong>Settings</strong> on your iPhone.
            </li>
            <li>
              Scroll to <strong>YOUNGO Hub</strong> and tap it.
            </li>
            <li>
              Tap <strong>Notifications</strong> and switch{' '}
              <strong>Allow Notifications</strong> on.
            </li>
            <li>Come back here and turn notifications on.</li>
          </>
        ) : (
          <>
            <li>
              Tap the padlock or settings icon next to the address bar in your
              browser.
            </li>
            <li>
              Find <strong>Notifications</strong> and set it to{' '}
              <strong>Allow</strong>.
            </li>
            <li>Reload this page and turn notifications on.</li>
          </>
        )}
      </ol>
    </div>
  )
}

/** Reference for the other platforms, collapsed so it does not crowd the page. */
function DeviceInstructions() {
  return (
    <details className="card cardTight notificationHelp">
      <summary>Setting notifications up on your phone or laptop</summary>
      <div className="notificationHelpBody">
        <div>
          <h4>iPhone / iPad</h4>
          <p className="meta">
            Safari › Share › Add to Home Screen › open the Hub from the icon ›
            Turn on notifications › Allow. Requires iOS 16.4 or later. A Focus
            mode or Do Not Disturb will still hold alerts back — allow YOUNGO
            Hub under Settings › Focus if you want deadline alerts through.
          </p>
        </div>
        <div>
          <h4>Android</h4>
          <p className="meta">
            Chrome › menu › Add to Home screen (recommended, not required) ›
            Turn on notifications › Allow. If nothing arrives, check Settings ›
            Apps › Chrome › Notifications, and any battery saver that restricts
            background activity.
          </p>
        </div>
        <div>
          <h4>Laptop / desktop</h4>
          <p className="meta">
            Turn on notifications and choose Allow in the browser prompt. On
            macOS, also allow your browser under System Settings ›
            Notifications. Alerts arrive while the browser is running, even with
            the Hub tab closed.
          </p>
        </div>
        <div>
          <h4>Each device is separate</h4>
          <p className="meta">
            Turning notifications on here covers this browser on this device
            only. Repeat on any other device where you want alerts. On a shared
            device, turn them off before handing it over.
          </p>
        </div>
      </div>
    </details>
  )
}
