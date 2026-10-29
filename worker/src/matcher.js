/**
 * F7 matching core.
 *
 * Part 1 is dry-run: it writes `donorMatches` and `bloodRequests.matching` but
 * sends no notifications. The function is shared by the HTTP trigger (F3) and
 * the one-minute cron fallback.
 */

import {
  compatibleDonorBloodTypes,
  distanceKm,
  donationTypeForComponent,
  geohashPrefixesForRadius,
  isCompatibleDonor,
  sortRequestsByUrgency,
} from '../../web/src/utils/matching.js'
import { eligibilityFor } from '../../web/src/utils/eligibility.js'
import { geohashDecode, isCoordinate } from '../../web/src/utils/geohash.js'
import { getDocument, runQuery, updateDocumentIfUnchanged, writeNewDocuments } from './firestore.js'
import { HttpError } from './http.js'

const ACTIVE_STATUSES = ['urgent', 'collecting']
const DEFAULT_TIERS = [
  { radiusKm: 5, waitMinutes: 10 },
  { radiusKm: 10, waitMinutes: 15 },
  { radiusKm: 15, waitMinutes: 20 },
  { radiusKm: 20, waitMinutes: 25 },
  { radiusKm: 25, waitMinutes: 30 },
]
const DEFAULT_INTERVALS = {
  'whole-blood': 56,
  platelets: 7,
  plasma: 28,
  'double-red-cells': 112,
}
const DONOR_QUERY_LIMIT = 300
const EXISTING_MATCH_LIMIT = 1000
const CRON_REQUEST_LIMIT = 20

function pointFor(data) {
  if (isCoordinate(data?.latitude, data?.longitude)) {
    return { lat: Number(data.latitude), lng: Number(data.longitude) }
  }
  const decoded = data?.geohash ? geohashDecode(data.geohash) : null
  return decoded ? { lat: decoded.lat, lng: decoded.lng } : null
}

function stringValue(value) {
  return { stringValue: value }
}

function equalityFilter(fieldPath, value) {
  return {
    fieldFilter: {
      field: { fieldPath },
      op: 'EQUAL',
      value: stringValue(value),
    },
  }
}

function inFilter(fieldPath, values) {
  return {
    fieldFilter: {
      field: { fieldPath },
      op: 'IN',
      value: { arrayValue: { values: values.map(stringValue) } },
    },
  }
}

function rangeFilter(fieldPath, op, value) {
  return {
    fieldFilter: {
      field: { fieldPath },
      op,
      value: stringValue(value),
    },
  }
}

function andFilter(filters) {
  if (filters.length === 1) return filters[0]
  return { compositeFilter: { op: 'AND', filters } }
}

function normaliseTiers(value) {
  if (!Array.isArray(value)) return DEFAULT_TIERS
  const tiers = value
    .map((tier) => ({
      radiusKm: Number(tier?.radiusKm),
      waitMinutes: Number(tier?.waitMinutes),
    }))
    .filter((tier) => Number.isFinite(tier.radiusKm) && tier.radiusKm > 0)
    .map((tier) => ({
      radiusKm: tier.radiusKm,
      waitMinutes: Number.isFinite(tier.waitMinutes) && tier.waitMinutes >= 0 ? tier.waitMinutes : 10,
    }))
  return tiers.length > 0 ? tiers : DEFAULT_TIERS
}

async function loadTiers(env) {
  const config = await getDocument(env, 'systemConfig', 'global')
  return normaliseTiers(config?.data?.radiusTiers)
}

async function loadDonationType(env, id) {
  const document = await getDocument(env, 'donationTypes', id)
  if (document?.data?.isActive === false) {
    throw new HttpError(422, `Donation type ${id} is inactive`)
  }

  const intervalDays = Number(document?.data?.intervalDays)
  if (Number.isFinite(intervalDays) && intervalDays > 0) {
    return { id, intervalDays }
  }
  if (DEFAULT_INTERVALS[id]) {
    return { id, intervalDays: DEFAULT_INTERVALS[id] }
  }
  throw new HttpError(500, `No deferral interval configured for ${id}`)
}

async function queryDonors(env, bloodTypes, prefixes) {
  const donors = new Map()

  for (const prefix of prefixes) {
    const where = andFilter([
      equalityFilter('role', 'donor'),
      equalityFilter('status', 'Active'),
      inFilter('bloodType', bloodTypes),
      rangeFilter('geohash', 'GREATER_THAN_OR_EQUAL', prefix),
      rangeFilter('geohash', 'LESS_THAN_OR_EQUAL', `${prefix}\uf8ff`),
    ])

    const rows = await runQuery(env, {
      from: [{ collectionId: 'users' }],
      where,
      orderBy: [{ field: { fieldPath: 'geohash' }, direction: 'ASCENDING' }],
      limit: DONOR_QUERY_LIMIT,
    })
    for (const donor of rows) {
      if (!donors.has(donor.id)) donors.set(donor.id, donor)
    }
  }

  return [...donors.values()]
}

async function queryExistingMatches(env, requestId) {
  return runQuery(env, {
    from: [{ collectionId: 'donorMatches' }],
    where: equalityFilter('requestId', requestId),
    limit: EXISTING_MATCH_LIMIT,
  })
}

/**
 * Pure selection step: compatibility, distance, deferral, and already-matched
 * donors. Exported for tests; the Worker uses it inside `processRequest`.
 */
export function selectMatches({
  request,
  requestPoint,
  donors,
  existingMatchIds = new Set(),
  donationType,
  tier,
  now = new Date(),
}) {
  const compatibleTypes = compatibleDonorBloodTypes(request.bloodType, request.component)
  const skipped = {
    existing: 0,
    self: 0,
    inactive: 0,
    incompatible: 0,
    noEmail: 0,
    noLocation: 0,
    outOfRange: 0,
    ineligible: 0,
  }
  const matches = []

  for (const donor of donors) {
    if (existingMatchIds.has(donor.id)) {
      skipped.existing += 1
      continue
    }
    if (donor.id === request.createdBy) {
      skipped.self += 1
      continue
    }

    const profile = donor.data ?? {}
    if (profile.role !== 'donor' || (profile.status ?? 'Active') !== 'Active') {
      skipped.inactive += 1
      continue
    }
    if (!profile.email) {
      skipped.noEmail += 1
      continue
    }
    if (
      !compatibleTypes.includes(profile.bloodType) ||
      !isCompatibleDonor(request.bloodType, profile.bloodType, request.component)
    ) {
      skipped.incompatible += 1
      continue
    }

    const donorPoint = pointFor(profile)
    if (!donorPoint) {
      skipped.noLocation += 1
      continue
    }
    const km = distanceKm(requestPoint, donorPoint)
    if (km === null || km > tier.radiusKm) {
      skipped.outOfRange += 1
      continue
    }

    const eligibility = eligibilityFor(
      {
        dateOfBirth: profile.dateOfBirth,
        lastDonationAt: profile.lastDonationAt,
        intervalDays: donationType.intervalDays,
      },
      now,
    )
    if (!eligibility.eligible) {
      skipped.ineligible += 1
      continue
    }

    matches.push({
      requestId: request.id,
      donorId: donor.id,
      donationTypeId: donationType.id,
      component: request.component,
      tier: tier.number,
      distanceKm: Math.round(km * 10) / 10,
      responseStatus: 'Pending',
      guidelinesAcknowledged: false,
      matchedAt: now,
    })
  }

  return { matches, skipped }
}

function parseDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Match one request at its next radius tier (Part 3 supports expansion).
 *
 * If currentTier == 0, process tier 1 immediately. If currentTier >= 1 and
 * nextTierAt has passed, process the next tier. The request update is
 * conditional on `updateTime` to avoid races.
 */
export async function processRequest(env, request, { now = new Date(), source = 'api' } = {}) {
  const data = request.data ?? {}
  const currentTier = Number(data.matching?.currentTier ?? 0)

  if (!ACTIVE_STATUSES.includes(data.status)) {
    return { requestId: request.id, skipped: 'not-active', status: data.status }
  }
  if (data.matching?.exhausted === true) {
    return { requestId: request.id, skipped: 'exhausted' }
  }

  const tiers = await loadTiers(env)
  let tierIndex = 0
  if (currentTier === 0) {
    tierIndex = 0
  } else {
    const nextTierAt = parseDate(data.matching?.nextTierAt)
    if (nextTierAt && now < nextTierAt && source !== 'cron-force') {
      return { requestId: request.id, skipped: 'tier-not-due', currentTier, nextTierAt }
    }
    tierIndex = currentTier
    if (tierIndex >= tiers.length) {
      const matching = {
        exhausted: true,
        lastRunAt: now,
        lastRunMs: 0,
      }
      await updateDocumentIfUnchanged(env, `bloodRequests/${request.id}`, { matching }, request.updateTime).catch(() => {})
      return { requestId: request.id, skipped: 'exhausted', exhausted: true }
    }
  }

  const tier = { ...tiers[tierIndex], number: tierIndex + 1 }
  const donationTypeId = donationTypeForComponent(data.component)
  if (!donationTypeId) throw new HttpError(422, `Unsupported request component: ${data.component}`)

  const donationType = await loadDonationType(env, donationTypeId)
  const compatibleTypes = compatibleDonorBloodTypes(data.bloodType, data.component)
  if (compatibleTypes.length === 0) {
    throw new HttpError(422, `Unsupported blood type/component: ${data.bloodType}/${data.component}`)
  }

  const requestPoint = pointFor(data)
  if (!requestPoint) throw new HttpError(422, 'Request has no usable coordinates')

  const prefixes = geohashPrefixesForRadius(requestPoint.lat, requestPoint.lng, tier.radiusKm)
  if (prefixes.length === 0) throw new HttpError(500, 'Could not build a geohash search')

  const startedAt = Date.now()
  const donors = await queryDonors(env, compatibleTypes, prefixes)
  const queryMs = Date.now() - startedAt
  const existingStarted = Date.now()
  const existing = await queryExistingMatches(env, request.id)
  const existingMs = Date.now() - existingStarted
  const { matches, skipped } = selectMatches({
    request: { ...data, id: request.id },
    requestPoint,
    donors,
    existingMatchIds: new Set(existing.map((match) => match.data?.donorId).filter(Boolean)),
    donationType,
    tier,
    now,
  })

  const writes = matches.map((match) => ({
    path: `donorMatches/${request.id}_${match.donorId}`,
    data: match,
  }))
  const writeStarted = Date.now()
  const written = await writeNewDocuments(env, writes)
  const writeMs = Date.now() - writeStarted

  const totalMs = Date.now() - startedAt
  const isLastTier = tierIndex + 1 >= tiers.length
  const matching = {
    currentTier: tier.number,
    nextTierAt: isLastTier ? null : new Date(now.getTime() + tier.waitMinutes * 60_000),
    lastRunAt: now,
    lastRunMs: totalMs,
    matchedDonorCount: Number(data.matching?.matchedDonorCount ?? 0) + written.created,
    exhausted: isLastTier,
  }
  // Per-phase timing so NFR-01/02/05 can be measured in deployment.
  const timings = { queryMs, existingMs, writeMs, totalMs }
  console.log('match run', {
    requestId: request.id,
    tier: tier.number,
    donors: donors.length,
    matched: written.created,
    ...timings,
  })
  const updated = await updateDocumentIfUnchanged(
    env,
    `bloodRequests/${request.id}`,
    { matching },
    request.updateTime,
  )

  // Notify newly created matches for this tier
  try {
    const { notifyNewMatches } = await import('./notify.js')
    await notifyNewMatches(
      env,
      { id: request.id, data },
      matches.map((m) => ({ requestId: request.id, donorId: m.donorId, component: m.component })),
    )
  } catch (e) {
    console.error('notification fan-out failed', { message: e?.message })
  }

  return {
    requestId: request.id,
    source,
    dryRun: true,
    tier: tier.number,
    radiusKm: tier.radiusKm,
    considered: donors.length,
    matched: written.created,
    existing: written.existing,
    skipped,
    totalMatched: matching.matchedDonorCount,
    exhausted: matching.exhausted,
    updated,
    durationMs: matching.lastRunMs,
    timings,
  }
}

/** Load one request and match it. Used by the HTTP route. */
export async function matchRequest(env, requestId, options = {}) {
  const request = await getDocument(env, 'bloodRequests', requestId)
  if (!request) throw new HttpError(404, 'Request not found')
  return processRequest(env, request, options)
}

/**
 * Cron fallback: process a small batch of active requests that have never been
 * matched. The immediate F3 call remains the fast path.
 */
export async function runMatchingCycle(env, { now = new Date() } = {}) {
  const rows = await runQuery(env, {
    from: [{ collectionId: 'bloodRequests' }],
    where: inFilter('status', ACTIVE_STATUSES),
    limit: CRON_REQUEST_LIMIT,
  })

  const candidates = rows
    .filter((row) => {
      const m = row.data?.matching ?? {}
      if (m.exhausted === true) return false
      if (!m.currentTier) return true
      const next = parseDate(m.nextTierAt)
      if (!next) return false
      return now >= next
    })
    .map((row) => ({ ...row.data, id: row.id, raw: row }))

  let matched = 0
  let failed = 0
  const results = []

  for (const candidate of sortRequestsByUrgency(candidates)) {
    try {
      const result = await processRequest(env, candidate.raw, { now, source: 'cron' })
      matched += result.matched ?? 0
      results.push(result)
    } catch (error) {
      failed += 1
      console.error('matching failed', { requestId: candidate.id, message: error?.message })
    }
  }

  return { considered: candidates.length, matched, failed, results }
}
