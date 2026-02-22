/**
 * App config. ADMIN_PASSCODE is used server-side; client uses server verify.
 * Override via env at build time if needed.
 */
export const ADMIN_PASSCODE = typeof import.meta?.env?.VITE_ADMIN_PASSCODE === 'string'
  ? import.meta.env.VITE_ADMIN_PASSCODE
  : '1234'
