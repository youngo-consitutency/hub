import type { AnyValue } from './types'
let deferredInstallPrompt: AnyValue = null
const HUB_CACHE_PREFIX = 'youngo-hub-'

export async function disablePWAInDevelopment() {
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
    if ('caches' in window) {
      const names = await window.caches.keys()
      await Promise.all(
        names
          .filter((name) => name.startsWith(HUB_CACHE_PREFIX))
          .map((name) => window.caches.delete(name)),
      )
    }
  } catch (error) {
    console.warn('[PWA] Could not clear the development service worker:', error)
  }
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] Service Worker not supported')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            if (confirm('A new version of YOUNGO Hub is available. Reload to update?')) {
              window.location.reload()
            }
          }
        })
      }
    })

    setInterval(() => registration.update(), 1000 * 60 * 60)

    return registration
  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error)
    return null
  }
}

/**
 * True when this browser can do Web Push at all. Safari on iOS reports both
 * APIs but only honours them for a home-screen install; `canSubscribeToPush`
 * below is the check the UI should gate its button on.
 */
export function isPushSupported() {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** iPhone / iPad, including iPadOS reporting itself as a Mac with touch. */
export function isIOS() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/**
 * iOS only delivers Web Push to a site installed on the Home Screen (16.4+).
 * In a Safari tab the subscribe call fails, so the UI must show the install
 * steps instead of an enable button.
 */
export function needsHomeScreenInstall() {
  return isIOS() && !isPWA()
}

/**
 * Resolve the active service worker registration without hanging.
 * `navigator.serviceWorker.ready` never settles when nothing is registered —
 * which is the normal state in local development, where the worker is
 * deliberately unregistered.
 */
export async function getPushRegistration() {
  if (!isPushSupported()) return null
  try {
    return (await navigator.serviceWorker.getRegistration('/')) || null
  } catch {
    return null
  }
}

/**
 * Convert base64 string to Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String: AnyValue) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Subscribe to push notifications
 * @param {string} vapidPublicKey - VAPID public key from backend
 */
export async function subscribeToPush(vapidPublicKey: AnyValue) {
  if (!isPushSupported()) {
    console.log('[Push] Push not supported')
    return { success: false, error: 'Push not supported' }
  }

  try {
    const registration = (await getPushRegistration()) || (await registerServiceWorker())
    if (!registration) {
      return {
        success: false,
        error: 'Notifications need the installed app. Reload and try again.',
      }
    }

    let subscription = await registration.pushManager.getSubscription()
    const isNew = !subscription

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
    }

    // Always register an existing browser subscription again. On a shared
    // device this safely moves the endpoint to the currently signed-in account.
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    })

    if (!response.ok) {
      throw new Error('Failed to save subscription on server')
    }

    return { success: true, subscription, isNew }
  } catch (error) {
    console.error('[Push] Subscription failed:', error)
    return { success: false, error: (error as AnyValue).message }
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush() {
  if (!isPushSupported()) {
    return { success: false, error: 'Push not supported' }
  }

  try {
    const registration = await getPushRegistration()
    if (!registration) return { success: true }
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      // Notify backend
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })

      await subscription.unsubscribe()
      console.log('[Push] Unsubscribed successfully')
    }

    return { success: true }
  } catch (error) {
    console.error('[Push] Unsubscribe failed:', error)
    return { success: false, error: (error as AnyValue).message }
  }
}

/**
 * Check current push subscription status
 */
export async function getPushSubscriptionStatus() {
  if (!isPushSupported()) {
    return { supported: false, subscribed: false }
  }

  try {
    const registration = await getPushRegistration()
    if (!registration) {
      // No worker yet: supported by the browser, not yet installed here.
      return {
        supported: true,
        registered: false,
        subscribed: false,
        permission: Notification.permission,
      }
    }
    const subscription = await registration.pushManager.getSubscription()
    const permission = Notification.permission

    return {
      supported: true,
      registered: true,
      subscribed: !!subscription,
      permission,
      subscription: subscription
        ? {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime,
          }
        : null,
    }
  } catch (error) {
    console.error('[Push] Status check failed:', error)
    return { supported: true, subscribed: false, error: (error as AnyValue).message }
  }
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return { granted: false, error: 'Notifications not supported' }
  }

  if (Notification.permission === 'granted') {
    return { granted: true }
  }

  if (Notification.permission === 'denied') {
    return { granted: false, error: 'Permission denied' }
  }

  const permission = await Notification.requestPermission()
  return { granted: permission === 'granted', permission }
}

/**
 * Check if app is running in standalone mode (PWA)
 */
export function isPWA() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as AnyValue).standalone === true
  )
}

/**
 * Check if app can be installed (beforeinstallprompt event)
 */
export function setupInstallPrompt(onPrompt?: AnyValue) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredInstallPrompt = e
    onPrompt?.(true)
  })

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null
    onPrompt?.(false)
  })
}

export async function promptInstall() {
  if (!deferredInstallPrompt) return { success: false, error: 'No install prompt available' }
  deferredInstallPrompt.prompt()
  const { outcome } = await deferredInstallPrompt.userChoice
  deferredInstallPrompt = null
  return { success: outcome === 'accepted' }
}

export function isInstallPromptAvailable() {
  return Boolean(deferredInstallPrompt)
}

export async function initPWA() {
  setupInstallPrompt((available: AnyValue) => {
    window.dispatchEvent(new CustomEvent('pwa-install-available', { detail: { available } }))
  })
  const registration = await registerServiceWorker()
  return { registration, isStandalone: isPWA() }
}
