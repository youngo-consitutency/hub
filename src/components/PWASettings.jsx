/**
 * PWASettings - Component for managing PWA and push notification settings
 */
import { useState, useEffect } from 'react';
import {
  subscribeToPush,
  unsubscribeFromPush,
  getPushSubscriptionStatus,
  requestNotificationPermission,
  isPWA
} from '../../lib/pwa.js';

export function PWASettings() {
  const [status, setStatus] = useState({
    supported: false,
    subscribed: false,
    permission: 'default',
    isPWA: false
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    const status = await getPushSubscriptionStatus();
    setStatus({
      supported: status.supported,
      subscribed: status.subscribed,
      permission: status.permission,
      isPWA: isPWA()
    });
    setLoading(false);
  };

  const handleSubscribe = async () => {
    setActionLoading(true);
    setMessage(null);

    try {
      // Request permission first
      const permResult = await requestNotificationPermission();
      if (!permResult.granted) {
        setMessage({ type: 'error', text: 'Notification permission denied' });
        setActionLoading(false);
        return;
      }

      // Get VAPID public key from server
      const response = await fetch('/api/push/vapid-public-key', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Push not configured on server');
      }
      const { publicKey } = await response.json();

      // Subscribe
      const result = await subscribeToPush(publicKey);
      if (result.success) {
        setMessage({ type: 'success', text: result.isNew ? 'Subscribed to push notifications!' : 'Already subscribed' });
        await checkStatus();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to subscribe' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setActionLoading(false);
  };

  const handleUnsubscribe = async () => {
    setActionLoading(true);
    setMessage(null);

    try {
      const result = await unsubscribeFromPush();
      if (result.success) {
        setMessage({ type: 'success', text: 'Unsubscribed from push notifications' });
        await checkStatus();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to unsubscribe' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setActionLoading(false);
  };

  const handleTestNotification = async () => {
    setActionLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: 'Test Notification',
          body: 'This is a test push notification from YOUNGO Hub!',
          url: '/'
        })
      });

      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: `Test notification sent to ${result.sent} device(s)` });
      } else {
        setMessage({ type: 'error', text: result.error?.message || 'Failed to send test' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setActionLoading(false);
  };

  if (!status.supported) {
    return (
      <div className="card">
        <h3>Push Notifications</h3>
        <p className="muted">Push notifications are not supported in this browser.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Push Notifications</h3>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        Receive real-time updates for messages, events, and important announcements.
      </p>

      <div className="settings-row">
        <div>
          <strong>Status:</strong> {loading ? 'Checking…' : status.subscribed ? 'Subscribed' : 'Not subscribed'}
        </div>
        <div>
          <strong>Permission:</strong> {status.permission}
        </div>
        <div>
          <strong>PWA Mode:</strong> {status.isPWA ? 'Installed (standalone)' : 'Browser tab'}
        </div>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`} style={{ marginTop: '1rem' }}>
          {message.text}
        </div>
      )}

      <div className="button-group" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {status.subscribed ? (
          <>
            <button
              className="btn btn-danger"
              onClick={handleUnsubscribe}
              disabled={actionLoading}
            >
              {actionLoading ? 'Unsubscribing...' : 'Unsubscribe'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleTestNotification}
              disabled={actionLoading}
            >
              {actionLoading ? 'Sending...' : 'Send Test'}
            </button>
          </>
        ) : (
          <button
            className="btn btn-primary"
            onClick={handleSubscribe}
            disabled={actionLoading || status.permission === 'denied'}
          >
            {actionLoading ? 'Subscribing...' : 'Subscribe to Notifications'}
          </button>
        )}

        {status.permission === 'denied' && (
          <span className="muted" style={{ alignSelf: 'center' }}>
            Notifications blocked. Enable in browser settings.
          </span>
        )}
      </div>

      <details className="card" style={{ marginTop: '1.5rem' }}>
        <summary>Install as App</summary>
        <div style={{ padding: '1rem 0' }}>
          <p className="muted">
            {status.isPWA
              ? 'YOUNGO Hub is already installed as a standalone app.'
              : 'Add YOUNGO Hub to your home screen for app-like experience and push notifications.'
            }
          </p>
          {!status.isPWA && (
            <InstallPrompt />
          )}
        </div>
      </details>
    </div>
  );
}

function InstallPrompt() {
  const [promptAvailable, setPromptAvailable] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const handleAvailable = (e) => setPromptAvailable(e.detail.available);
    window.addEventListener('pwa-install-available', handleAvailable);
    return () => window.removeEventListener('pwa-install-available', handleAvailable);
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      // The beforeinstallprompt is handled by the service worker
      // We can trigger it by dispatching a custom event
      window.dispatchEvent(new CustomEvent('pwa-install'));
      setPromptAvailable(false);
    } catch (error) {
      console.error('Install failed:', error);
    }
    setInstalling(false);
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      {promptAvailable && (
        <button
          className="btn btn-primary"
          onClick={handleInstall}
          disabled={installing}
        >
          {installing ? 'Installing...' : 'Install App'}
        </button>
      )}
      {!promptAvailable && !isPWA() && (
        <p className="muted">
          Install prompt will appear when available. You can also use your browser&apos;s
          "Add to Home Screen" or "Install App" option.
        </p>
      )}
    </div>
  );
}

export default PWASettings;