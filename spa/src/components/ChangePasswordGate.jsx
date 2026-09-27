import { TbKey as KeyRound } from 'react-icons/tb'
import { ChangePasswordForm } from './ChangePasswordForm.jsx'
import { Button } from './ui.jsx'
import { signOut } from '../lib/logout.js'

export function ChangePasswordGate({ account, onChanged }) {
  return (
    <div className="mandateGate">
      <div
        className="mandateShell"
        style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}
      >
        <div className="card">
          <div className="rowGap" style={{ marginBottom: 8 }}>
            <span className="iconTile">
              <KeyRound size={22} strokeWidth={1.75} aria-hidden />
            </span>
            <div>
              <h1>Choose your own password</h1>
              <p className="meta" style={{ marginTop: 4 }}>
                {account?.email
                  ? `${account.email} still uses the shared Hub password.`
                  : 'This account still uses the shared Hub password.'}{' '}
                Set one only you know (at least 10 characters) before opening
                the rest of the Hub.
              </p>
            </div>
          </div>
          <ChangePasswordForm
            submitLabel="Save and continue"
            onChanged={onChanged}
          />
          <div className="detailActions" style={{ marginTop: 16 }}>
            <Button variant="ghost" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
