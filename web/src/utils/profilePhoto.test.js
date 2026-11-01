import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isProfilePhotoUrl, profilePhotoProblem, PROFILE_PHOTO_MAX_BYTES } from './profilePhoto.js'

test('accepts only Cloudinary HTTPS image delivery URLs or removal', () => {
  for (const url of ['', 'https://res.cloudinary.com/example/image/upload/v1/profile.jpg', 'https://res.cloudinary.com/example/image/upload/c_fill,w_200/v1/profile.webp']) assert.equal(isProfilePhotoUrl(url), true, url)
  for (const url of [null, {}, 'javascript:alert(1)', 'http://res.cloudinary.com/example/image/upload/photo.jpg', 'https://res.cloudinary.com.evil.test/example/image/upload/photo.jpg', 'https://res.cloudinary.com/example/video/upload/photo.jpg', 'https://other.test/photo.jpg', 'https://res.cloudinary.com/example/image/upload/photo.jpg?secret=value', 'https://res.cloudinary.com/example/image/upload/a b.jpg', 'https://res.cloudinary.com/example/image/upload/' + 'a'.repeat(2048)]) assert.equal(isProfilePhotoUrl(url), false, String(url))
})

test('rejects unsupported, empty and oversized files before upload', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) assert.equal(profilePhotoProblem({ type, size: PROFILE_PHOTO_MAX_BYTES }), '')
  for (const file of [null, { type: 'image/svg+xml', size: 100 }, { type: 'application/pdf', size: 100 }, { type: 'image/png', size: 0 }, { type: 'image/jpeg', size: PROFILE_PHOTO_MAX_BYTES + 1 }]) assert.ok(profilePhotoProblem(file))
})
