import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost } from './api.js'
import {
  getPushSubscriptionStatus,
  isInstallPromptAvailable,
  isPushSupported,
  needsHomeScreenInstall,
  promptInstall,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from './pwa.js'

export const DISMISS_KEY = 'youngo-hub:alert-setup-dismissed'

export function useAlertSetup() {
  const [state, setState] = useState({ loading: true })
  const [installAvailable, setInstallAvailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  const refresh = useCallback(async () => {
    const browser = await getPushSubscriptionStatus()
    let configured
    try {
      await apiGet('/push/vapid-key')
      configured = true
    } catch (fetchError) {
      configured = fetchError.status !== 503
    }
    setState({ loading: false, configured, ...browser })
    setInstallAvailable(isInstallPromptAvailable())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onPrompt = (event) =>
      setInstallAvailable(Boolean(event.detail?.available))
    window.addEventListener('pwa-install-available', onPrompt)
    return () => window.removeEventListener('pwa-install-available', onPrompt)
  }, [])

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
        return false
      }
      const { publicKey } = await apiGet('/push/vapid-key')
      const result = await subscribeToPush(publicKey)
      if (!result.success) {
        setError(result.error || 'Could not turn notifications on.')
        return false
      }
      setMessage('Notifications are on for this device.')
      await refresh()
      return true
    } catch (thrown) {
      setError(thrown.message)
      return false
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
        return false
      }
      setMessage('Notifications are off for this device.')
      await refresh()
      return true
    } catch (thrown) {
      setError(thrown.message)
      return false
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
      return true
    } catch (thrown) {
      setError(thrown.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const install = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await promptInstall()
      if (!result.success) {
        setError(
          result.error === 'No install prompt available'
            ? 'This browser has no install prompt. Use the device steps below.'
            : result.error,
        )
        return false
      }
      setMessage('Hub installed. Turn alerts on next.')
      setInstallAvailable(false)
      await refresh()
      return true
    } catch (thrown) {
      setError(thrown.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Storage may be unavailable in privacy-restricted contexts.
    }
    setDismissed(true)
  }

  const supported = !state.loading && isPushSupported()
  const installFirst = !state.loading && needsHomeScreenInstall()
  const blocked = state.permission === 'denied'
  const needsAction =
    !state.loading &&
    supported &&
    state.configured &&
    !state.subscribed &&
    !blocked

  return {
    state,
    installAvailable,
    busy,
    message,
    error,
    dismissed,
    supported,
    installFirst,
    blocked,
    needsAction,
    refresh,
    enable,
    disable,
    sendTest,
    install,
    dismiss,
  }
}
