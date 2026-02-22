/**
 * Admin unlock: localStorage with 1h expiry.
 * Passcode stored in sessionStorage for API calls (cleared on tab close).
 */

const STORAGE_KEY = 'adminUnlock'
const PASSCODE_KEY = 'adminPasscode'
const EXPIRY_MS = 60 * 60 * 1000 // 1 hour

export function isAdminUnlocked() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const { until } = JSON.parse(raw)
    if (typeof until !== 'number' || Date.now() >= until) {
      clearAdminUnlock()
      return false
    }
    return true
  } catch {
    return false
  }
}

export function setAdminUnlocked(passcode) {
  try {
    const until = Date.now() + EXPIRY_MS
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ until }))
    sessionStorage.setItem(PASSCODE_KEY, passcode || '')
    return true
  } catch {
    return false
  }
}

export function clearAdminUnlock() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(PASSCODE_KEY)
  } catch {}
}

export function getAdminHeaders() {
  const passcode = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(PASSCODE_KEY) : ''
  return { 'X-Admin-Passcode': passcode || '' }
}
