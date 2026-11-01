/**
 * `systemConfig/global` (schema §2.11) — the tiered-radius ladder and
 * notification-retry settings (FR-041). F4 reads it for the donor map; the F9
 * settings screen reads and writes it.
 */

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

/**
 * Bounds the settings screen and the rules both enforce (FR-041). They are the
 * same numbers in `firestore.rules` (`isRadiusTier()`), so a hand-written client
 * cannot store a value the matcher would choke on.
 */
export const CONFIG_LIMITS = {
  retryLimit: { min: 0, max: 10 },
  retryInterval: { min: 1, max: 1440 },
  tiers: { min: 1, max: 8 },
  radiusKm: { min: 1, max: 100 },
  waitMinutes: { min: 1, max: 1440 },
}

/**
 * The seed shape from schema §8 / D18: the 5-10-15-20-25 km ladder, with the
 * 10/15/20/25/30 minute expansion waits.
 */
export const DEFAULT_CONFIG = {
  notifRetryLimit: 3,
  notifRetryInterval: 5,
  radiusTiers: [
    { tierOrder: 1, radiusKm: 5, waitMinutes: 10 },
    { tierOrder: 2, radiusKm: 10, waitMinutes: 15 },
    { tierOrder: 3, radiusKm: 15, waitMinutes: 20 },
    { tierOrder: 4, radiusKm: 20, waitMinutes: 25 },
    { tierOrder: 5, radiusKm: 25, waitMinutes: 30 },
  ],
}

function isInt(value) {
  return typeof value === 'number' && Number.isInteger(value)
}

function within(value, bounds) {
  return value >= bounds.min && value <= bounds.max
}

/**
 * Check a settings draft and return the document that should be written.
 *
 * The screen passes raw form values (strings from number inputs); this is the
 * one place that decides what is a valid tier, so the same rule applies on
 * reload, on save and in the tests.
 *
 * @param {{
 *   notifRetryLimit: number|string,
 *   notifRetryInterval: number|string,
 *   radiusTiers: Array<{ radiusKm: number|string, waitMinutes: number|string }>,
 * }} draft
 * @returns {{ ok: true, config: typeof DEFAULT_CONFIG } | { ok: false, errors: string[] }}
 */
export function validateConfig(draft) {
  const errors = []
  const limit = Number(draft?.notifRetryLimit)
  const interval = Number(draft?.notifRetryInterval)

  if (!isInt(limit) || !within(limit, CONFIG_LIMITS.retryLimit)) {
    errors.push(
      `Retry limit must be a whole number from ${CONFIG_LIMITS.retryLimit.min} to ${CONFIG_LIMITS.retryLimit.max}.`,
    )
  }
  if (!isInt(interval) || !within(interval, CONFIG_LIMITS.retryInterval)) {
    errors.push(
      `Retry interval must be a whole number of minutes from ${CONFIG_LIMITS.retryInterval.min} to ${CONFIG_LIMITS.retryInterval.max}.`,
    )
  }

  const rows = Array.isArray(draft?.radiusTiers) ? draft.radiusTiers : []
  if (rows.length < CONFIG_LIMITS.tiers.min || rows.length > CONFIG_LIMITS.tiers.max) {
    errors.push(
      `Keep between ${CONFIG_LIMITS.tiers.min} and ${CONFIG_LIMITS.tiers.max} radius tiers.`,
    )
  }

  const tiers = []
  rows.forEach((row, index) => {
    const radiusKm = Number(row?.radiusKm)
    const waitMinutes = Number(row?.waitMinutes)
    const label = `Tier ${index + 1}`
    if (!Number.isFinite(radiusKm) || !within(radiusKm, CONFIG_LIMITS.radiusKm)) {
      errors.push(
        `${label}: radius must be between ${CONFIG_LIMITS.radiusKm.min} and ${CONFIG_LIMITS.radiusKm.max} km.`,
      )
      return
    }
    if (!isInt(waitMinutes) || !within(waitMinutes, CONFIG_LIMITS.waitMinutes)) {
      errors.push(
        `${label}: wait must be a whole number of minutes from ${CONFIG_LIMITS.waitMinutes.min} to ${CONFIG_LIMITS.waitMinutes.max}.`,
      )
      return
    }
    tiers.push({ tierOrder: index + 1, radiusKm, waitMinutes })
  })

  // The matcher walks the array in order, so each tier must reach further than
  // the one before it; equal or shrinking radii would make a tier unreachable.
  for (let i = 1; i < tiers.length; i += 1) {
    if (tiers[i].radiusKm <= tiers[i - 1].radiusKm) {
      errors.push('Each radius tier must be larger than the tier before it.')
      break
    }
  }

  if (errors.length) return { ok: false, errors }
  return { ok: true, config: { notifRetryLimit: limit, notifRetryInterval: interval, radiusTiers: tiers } }
}

/** Normalise a stored document (absent or partial) into a full settings shape. */
export function normaliseConfig(raw) {
  const source = raw ?? {}
  const draft = {
    notifRetryLimit: source.notifRetryLimit ?? DEFAULT_CONFIG.notifRetryLimit,
    notifRetryInterval: source.notifRetryInterval ?? DEFAULT_CONFIG.notifRetryInterval,
    radiusTiers:
      Array.isArray(source.radiusTiers) && source.radiusTiers.length
        ? source.radiusTiers
        : DEFAULT_CONFIG.radiusTiers,
  }
  const checked = validateConfig(draft)
  return checked.ok ? checked.config : { ...DEFAULT_CONFIG }
}

/**
 * Read `systemConfig/global` (FR-041). Returns the normalised shape, or the
 * defaults when the document has never been written, so the settings screen
 * always has something valid to show.
 *
 * @returns {Promise<typeof DEFAULT_CONFIG & { updatedBy?: string, updatedAt?: Date|null }>}
 */
export async function readSystemConfig() {
  requireDb()
  const snap = await getDoc(doc(db, 'systemConfig', 'global'))
  if (!snap.exists()) return { ...DEFAULT_CONFIG, updatedBy: '', updatedAt: null }
  const data = snap.data() ?? {}
  return {
    ...normaliseConfig(data),
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
  }
}

/**
 * Save the settings document (admin only, FR-041).
 *
 * The caller passes the validated config from `validateConfig`; the stored
 * document carries the writer's uid and a server timestamp because the rules
 * require both.
 *
 * @param {{ notifRetryLimit: number, notifRetryInterval: number,
 *   radiusTiers: Array<{ tierOrder: number, radiusKm: number, waitMinutes: number }> }} config
 * @param {string} updatedBy
 */
export async function saveSystemConfig(config, updatedBy) {
  requireDb()
  const checked = validateConfig(config)
  if (!checked.ok) throw new Error(checked.errors[0])
  if (!updatedBy) throw new Error('Sign in again to save settings.')

  await setDoc(
    doc(db, 'systemConfig', 'global'),
    {
      ...checked.config,
      updatedBy,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

/** Read the config, or null. Donor-map alias for `readSystemConfig` (F4). */
export async function getSystemConfig() {
  return readSystemConfig()
}

/** Fallback ladder (km) when the config is unavailable (NFR-05). */
export const DEFAULT_RADIUS_TIERS = [5, 10, 15, 20, 25]
