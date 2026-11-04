export const routeLoaders = {
  DonorRegistry: () => import('../pages/admin/DonorRegistry.jsx'),
  Partner: () => import('../pages/public/Partner.jsx'),
  ForgotPassword: () => import('../pages/public/ForgotPassword.jsx'),
  VerifyEmail: () => import('../pages/public/VerifyEmail.jsx'),
  PrivacyPolicy: () => import('../pages/public/PrivacyPolicy.jsx'),
  NotFound: () => import('../pages/public/NotFound.jsx'),
  Welcome: () => import('../pages/shared/Welcome.jsx'),
  Dashboard: () => import('../pages/admin/Dashboard.jsx'),
  BloodRequests: () => import('../pages/admin/BloodRequests.jsx'),
  AuditTrail: () => import('../pages/admin/AuditTrail.jsx'),
  AdminAccounts: () => import('../pages/admin/Accounts.jsx'),
  AdminSettings: () => import('../pages/admin/Settings.jsx'),
  AdminDataRequests: () => import('../pages/admin/DataRequests.jsx'),
  Profile: () => import('../pages/donor/Profile.jsx'),
  HospitalProfile: () => import('../pages/hospital/Profile.jsx'),
  DonorSettings: () => import('../pages/donor/Settings.jsx'),
  Activity: () => import('../pages/donor/Activity.jsx'),
  DonorPrivacy: () => import('../pages/donor/Privacy.jsx'),
  Requests: () => import('../pages/donor/Requests.jsx'),
  Alerts: () => import('../pages/donor/Alerts.jsx'),
  HospitalRequests: () => import('../pages/hospital/Requests.jsx'),
  NewRequest: () => import('../pages/hospital/NewRequest.jsx'),
  HospitalDashboard: () => import('../pages/hospital/Dashboard.jsx'),
  Inventory: () => import('../pages/hospital/Inventory.jsx'),
  HospitalMap: () => import('../pages/hospital/Map.jsx'),
  HospitalSettings: () => import('../pages/hospital/Settings.jsx'),
  HospitalFacility: () => import('../pages/hospital/Facility.jsx'),
  InventoryLog: () => import('../pages/hospital/InventoryLog.jsx'),
  HospitalDonors: () => import('../pages/hospital/Donors.jsx'),
  Gallery: () => import('../pages/shared/Gallery.jsx'),
  ScreenStub: () => import('../pages/shared/ScreenStub.jsx'),
}

const paths = {
  '/home': 'Profile', '/donor/profile': 'Profile', '/donor/requests': 'Requests',
  '/donor/activity': 'Activity', '/donor/alerts': 'Alerts', '/donor/settings': 'DonorSettings',
  '/hospital/dashboard': 'HospitalDashboard', '/hospital/requests': 'HospitalRequests',
  '/hospital/requests/new': 'NewRequest', '/hospital/inventory': 'Inventory',
  '/hospital/inventory-log': 'InventoryLog', '/hospital/map': 'HospitalMap',
  '/hospital/profile': 'HospitalProfile', '/hospital/settings': 'HospitalSettings',
  '/hospital/donors': 'HospitalDonors', '/admin/dashboard': 'Dashboard',
  '/admin/accounts': 'AdminAccounts', '/admin/audit-trail': 'AuditTrail',
  '/admin/data-requests': 'AdminDataRequests', '/admin/settings': 'AdminSettings',
  '/admin/blood-requests': 'BloodRequests', '/admin/inventory': 'Inventory',
}
const pending = new Map()
/** Preload code only; no account or facility data is fetched. */
export function prefetchRoute(path) {
  const name = paths[path]
  if (!name || !routeLoaders[name] || pending.has(name)) return
  const promise = routeLoaders[name]().catch(() => { pending.delete(name) })
  pending.set(name, promise)
}
