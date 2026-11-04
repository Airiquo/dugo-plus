export * from '../../web/src/services/auth.js'
let current = JSON.parse(localStorage.getItem('fixture-user') || 'null')
const listeners = new Set()
function publish(user) {
  current = user
  localStorage.setItem('fixture-user', JSON.stringify(user))
  listeners.forEach(callback => callback(user))
}
window.fixture = {
  setAuth: publish,
  logoutMode: 'ok',
  logoutCalls: 0,
  writes: [],
}
export function observeAuth(callback) {
  listeners.add(callback)
  callback(current)
  return () => listeners.delete(callback)
}
export async function signIn(email) {
  const role = email.split('@')[0]
  const user = { uid: role, email, displayName: role, emailVerified: role !== 'unverified', providerData: [] }
  publish(user)
  return user
}
export async function signInWithGoogle() { return signIn('donor@example.test') }
export async function signOut() {
  window.fixture.logoutCalls++
  await new Promise(resolve => setTimeout(resolve, 150))
  if (window.fixture.logoutMode === 'fail') throw new Error('Fixture sign-out failure')
  publish(null)
}
export async function refreshClaims() {}
export async function reloadCurrentUser() { return current }
export async function sendVerificationEmail() {}
