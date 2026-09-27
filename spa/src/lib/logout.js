import { apiPost } from './api.js'
import { clearSession } from './session.js'

export async function signOut() {
  try {
    await apiPost('/auth/logout', {})
  } catch {
    // A failed network request must not trap someone in the local session UI.
  }
  clearSession()
  window.location.reload()
}
