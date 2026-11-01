import test from 'node:test'
import assert from 'node:assert/strict'
import { claimsForUser, createHospitalAccount, deleteAuthAccount } from './accounts.js'

const env = {}

test('claimsForUser maps users.role to the claim the rules check', () => {
  assert.deepEqual(claimsForUser({ role: 'donor' }), { role: 'donor' })
  assert.deepEqual(claimsForUser({ role: 'hospital', hospitalId: 'h-1' }), {
    role: 'staff',
    hospitalId: 'h-1',
  })
  assert.deepEqual(claimsForUser({ role: 'admin' }), { role: 'admin' })
  assert.equal(claimsForUser({ role: 'unknown' }), null)
  assert.equal(claimsForUser({}), null)
})

test('createHospitalAccount rejects a missing or invalid email before any call', async () => {
  await assert.rejects(() => createHospitalAccount(env, {}), /Email is required/)
  await assert.rejects(
    () => createHospitalAccount(env, { email: 'not-an-email' }),
    /valid email/,
  )
})

test('createHospitalAccount requires both coordinates', async () => {
  await assert.rejects(
    () =>
      createHospitalAccount(env, {
        email: 'clinic@example.com',
        password: 'longenough1',
        fullName: 'A',
        facilityName: 'B',
        address: 'C',
        contactNumber: '1',
        latitude: 14.5,
      }),
    /both coordinates/,
  )
})

test('createHospitalAccount rejects a malformed facility id', async () => {
  await assert.rejects(
    () =>
      createHospitalAccount(env, {
        email: 'clinic@example.com',
        password: 'longenough1',
        fullName: 'A',
        facilityName: 'B',
        address: 'C',
        contactNumber: '1',
        hospitalId: 'Bad ID!',
      }),
    /Facility id/,
  )
})

test('deleteAuthAccount refuses to delete the caller', async () => {
  await assert.rejects(
    () => deleteAuthAccount(env, 'admin-1', 'admin-1'),
    /cannot delete your own/,
  )
})
