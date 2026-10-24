/**
 * Sample blood-request data — the shape the API is expected to return.
 *
 * These fixtures are display-shaped for the list screen, not `bloodRequests`
 * documents: the data model for the real collection is
 * `docs/firestore_schema.md` §2.4 (with `donorMatches` §2.5 and `donations` §2.9
 * behind F4/F8). There is no `component` or free-text `requested` field in that
 * model, so a rebuilt screen reads the schema's fields and maps them to the same
 * `data-*` codes rather than expecting these objects.
 *
 * Screens read from here instead of copying mockup markup, so a page is a
 * mapping from data to components. When the backend lands these exports are
 * replaced by queries in `web/src/services/` and the pages stay unchanged.
 *
 * Codes are the values the stylesheet targets (`data-status`, `data-priority`,
 * `data-blood-type`, `data-component`); labels are display text only.
 */

/** `.chip[data-status]` values, in the order the filters list them. */
export const REQUEST_STATUSES = ['urgent', 'collecting', 'matched', 'fulfilled', 'cancelled']

/** `.chip[data-priority]` values. */
export const REQUEST_PRIORITIES = ['urgent', 'stat', 'routine']

/** Blood types, in the order the filters list them. */
export const BLOOD_TYPES = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']

/**
 * Blood components: `value` is the stored code (`data-component`), `label` is
 * the filter text and `short` is the table-cell text.
 */
export const COMPONENTS = [
  { value: 'whole-blood', label: 'Whole blood', short: 'Whole blood' },
  { value: 'rbc', label: 'Red cells (RBC)', short: 'Red cells' },
  { value: 'platelets', label: 'Platelets', short: 'Platelets' },
  { value: 'plasma', label: 'Plasma', short: 'Plasma' },
  { value: 'cryoprecipitate', label: 'Cryoprecipitate', short: 'Cryoprecipitate' },
]

/**
 * Display text for a component code.
 * @param {string} value - component code, e.g. 'rbc'
 * @param {'label'|'short'} [field] - 'label' (filters) or 'short' (table cells)
 */
export function componentLabel(value, field = 'short') {
  return COMPONENTS.find((c) => c.value === value)?.[field] ?? value
}

/**
 * Blood requests for `/admin/blood-requests`.
 * `sourceKind` is the `data-source` code ('hospital' | 'drive'); `source` is the
 * facility name shown in the table.
 */
export const REQUESTS = [
  {
    id: 'REQ-0001',
    patient: 'R.M.',
    bloodType: 'O-',
    component: 'rbc',
    qty: 6,
    priority: 'urgent',
    status: 'collecting',
    requested: '08:12 today',
    requiredBy: '14:00 today',
    source: 'Tagaytay City Medical Center',
    sourceKind: 'hospital',
  },
  {
    id: 'REQ-0002',
    patient: 'J.D.',
    bloodType: 'B+',
    component: 'platelets',
    qty: 10,
    priority: 'urgent',
    status: 'collecting',
    requested: '07:44 today',
    requiredBy: '12:00 today',
    source: 'Alfonso Red Cross drive, Nueva Ecija',
    sourceKind: 'drive',
  },
  {
    id: 'REQ-0003',
    patient: 'A.S.',
    bloodType: 'A-',
    component: 'plasma',
    qty: 8,
    priority: 'urgent',
    status: 'collecting',
    requested: '06:58 today',
    requiredBy: '16:00 today',
    source: 'Mother & Child Center, NICU',
    sourceKind: 'hospital',
  },
  {
    id: 'REQ-0004',
    patient: 'C.M.',
    bloodType: 'A+',
    component: 'rbc',
    qty: 4,
    priority: 'stat',
    status: 'matched',
    requested: 'Yesterday 16:20',
    requiredBy: 'Today 18:00',
    source: "St. Mary's Hospital, OR 3",
    sourceKind: 'hospital',
  },
  {
    id: 'REQ-0005',
    patient: 'L.T.',
    bloodType: 'O+',
    component: 'whole-blood',
    qty: 3,
    priority: 'routine',
    status: 'fulfilled',
    requested: 'Yesterday 09:05',
    requiredBy: 'Yesterday 17:00',
    source: 'Batangas City Red Cross drive',
    sourceKind: 'drive',
  },
]
