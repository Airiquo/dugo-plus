export * from '../../web/src/services/users.js'
export async function readProfile(uid) {
  await new Promise(resolve => setTimeout(resolve, 70))
  return { hospitalId: uid === 'hospital' ? 'fixture-hospital' : undefined, role: uid === 'unverified' ? 'donor' : uid, fullName: uid, email: `${uid}@example.test`, status: 'Active' }
}
