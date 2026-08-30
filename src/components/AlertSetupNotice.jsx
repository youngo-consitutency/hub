import { useEffect, useRef, useState } from 'react'
import {
  TbBell as Bell,
  TbDeviceMobile as Smartphone,
  TbPlus as Plus,
  TbX as X,
} from 'react-icons/tb'
import { usePath } from '../lib/router.js'
import { useAccount } from '../lib/accountContext.jsx'
import { currentDevice } from '../lib/device.js'
import { useAlertSetup } from '../lib/useAlertSetup.js'
import { NotificationGuide } from './NotificationGuide.jsx'
import { Button } from './ui.jsx'

/**
 * Persistent, dismissible prompt at the top of the Hub. Members were missing
 * install and alert setup because both lived only on Profile.
 */
export function AlertSetupNotice() {
  const path = usePath()
  const { account } = useAccount()
  const setup = useAlertSetup()
  const [helpOpen, setHelpOpen] = useState(false)
  const helpDialogRef = useRef(null)

  useEffect(() => {
    if (helpOpen && helpDialogRef.current && !helpDialogRef.current.open) {
      helpDialogRef.current.showModal()
    }
  }, [helpOpen])

  if (!account?.isVerified) return null
  if (path.startsWith('/profile')) return null
  if (setup.state.loading || setup.dismissed || !setup.needsAction) return null

  const ios = setup.installFirst
  const title = ios
    ? 'Add YOUNGO Hub to your Home Screen to get alerts'
    : 'Turn on alerts for this device'
  const action = ios ? (
    <Button sm variant="primary" onClick={() => setHelpOpen(true)}>
      <Smartphone size={16} strokeWidth={1.75} aria-hidden />
      Show me how
    </Button>
  ) : (
    <div className="noticeActions">
      {setup.installAvailable && (
        <Button
          sm
          variant="secondary"
          onClick={setup.install}
          disabled={setup.busy}
        >
          <Plus size={16} strokeWidth={1.75} aria-hidden />
          Install app
        </Button>
      )}
      <Button sm variant="primary" onClick={setup.enable} disabled={setup.busy}>
        <Bell size={16} strokeWidth={1.75} aria-hidden />
        {setup.busy ? 'Turning on…' : 'Turn on alerts'}
      </Button>
    </div>
  )

  return (
    <>
      <div
        className="noticeBanner noticeBannerInfo"
        role="region"
        aria-label={title}
      >
        <span className="noticeDot noticeDotInfo" />
        <div className="noticeCopy">
          <p>{title}</p>
          {ios && (
            <p className="metaMuted">
              Safari cannot send banners from a tab. Tap Show me how for the
              Share → Add to Home Screen steps.
            </p>
          )}
        </div>
        {action}
        <button
          type="button"
          className="iconButton"
          aria-label="Dismiss alert setup"
          onClick={setup.dismiss}
        >
          <X size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      {helpOpen && (
        <NotificationGuide
          device={currentDevice()}
          dialogRef={helpDialogRef}
          onClose={() => helpDialogRef.current?.close()}
          onClosed={() => setHelpOpen(false)}
        />
      )}
    </>
  )
}
