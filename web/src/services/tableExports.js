import { collection, getDocs, limit, orderBy, query, startAfter } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { BLOOD_TYPES, COMPONENTS } from '../utils/matching'
import { inventoryKey } from '../utils/inventory'
import { collectExportPages } from '../utils/tableExport'
import { getHospitalDonations } from './hospitals'
import { getAccountHistory, getAuditActivity } from './audit'

function requireDb() { if (!db) throw new Error('The database is not configured.') }
export function allHospitalDonations(hospitalId, options = {}, onProgress) {
  return collectExportPages(cursor => getHospitalDonations(hospitalId, { ...options, cursor, limit: 100 }), { onProgress })
}
export function allAuditActivity(filters = {}, onProgress) {
  return collectExportPages(cursor => getAuditActivity(filters, cursor), { rowsKey: 'events', cursorKey: 'nextCursor', onProgress })
}
export function allAccountHistory(accountId, onProgress) {
  return collectExportPages(cursor => getAccountHistory(accountId, cursor), { rowsKey: 'events', cursorKey: 'nextBefore', onProgress })
}

/** All component/group rows for one authorized facility, including unclassified legacy stock. */
export async function allInventory(hospitalId) {
  requireDb()
  if (!hospitalId) throw new Error('Choose a facility before exporting.')
  const snap = await getDocs(collection(db, 'hospitals', hospitalId, 'inventory'))
  const actual = new Map(snap.docs.map(item => [item.id, item.data()]))
  const rows = COMPONENTS.flatMap(component => BLOOD_TYPES.map(bloodType => ({
    bloodType, component, unitsAvailable: 0, ...actual.get(inventoryKey(component, bloodType)),
  })))
  for (const item of snap.docs) {
    const data = item.data()
    if (!data.component) rows.push({ ...data, bloodType: data.bloodType || item.id, component: 'Unclassified' })
  }
  return rows
}

/** Complete movement logs; fixed facility scope never expands to another facility. */
export async function allStockMovements(hospitalId, { component, bloodType } = {}, onProgress = () => {}) {
  requireDb()
  if (!hospitalId) throw new Error('Choose a facility before exporting.')
  let stocks
  if (component && bloodType) stocks = [{ id: component === 'unclassified' ? bloodType : inventoryKey(component, bloodType), bloodType, component }]
  else {
    const snap = await getDocs(collection(db, 'hospitals', hospitalId, 'inventory'))
    stocks = snap.docs.map(item => ({ id: item.id, ...item.data() }))
      .filter(row => (!component || (component === 'unclassified' ? !row.component : row.component === component)) && (!bloodType || row.bloodType === bloodType))
  }
  const rows = []
  // Bound concurrent reads; never turn a rejected stock page into a partial report.
  for (let offset = 0; offset < stocks.length; offset += 4) {
    const groups = await Promise.all(stocks.slice(offset, offset + 4).map(stock => collectExportPages(async cursor => {
      const constraints = [orderBy('createdAt', 'desc'), limit(100)]
      if (cursor) constraints.push(startAfter(cursor))
      const snap = await getDocs(query(collection(db, 'hospitals', hospitalId, 'inventory', stock.id, 'logs'), ...constraints))
      return { rows: snap.docs.map(item => ({ ...item.data(), createdAt: item.data().createdAt?.toDate?.() || item.data().createdAt, id: `${stock.id}/${item.id}`, bloodType: stock.bloodType, component: stock.component || 'Unclassified' })), cursor: snap.docs.length === 100 ? snap.docs.at(-1) : null }
    })))
    rows.push(...groups.flat()); onProgress(rows.length)
  }
  return rows.sort((a,b) => (b.createdAt?.toDate?.() || new Date(b.createdAt)).getTime() - (a.createdAt?.toDate?.() || new Date(a.createdAt)).getTime())
}
