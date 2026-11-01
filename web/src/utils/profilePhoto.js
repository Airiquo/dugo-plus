export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const PROFILE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Empty means the profile uses initials instead of a picture. */
export function isProfilePhotoUrl(value) {
  return typeof value === 'string' && value.length <= 2048 && (
    value === '' || /^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\/[^\s?#]+$/.test(value)
  )
}

/** Return a user-facing problem, or an empty string for a supported file. */
export function profilePhotoProblem(file) {
  if (!file || !PROFILE_PHOTO_TYPES.includes(file.type)) return 'Choose a JPG, PNG or WebP image.'
  if (!file.size) return 'This image is empty. Choose another photo.'
  if (file.size > PROFILE_PHOTO_MAX_BYTES) return 'Choose an image no larger than 5 MB.'
  return ''
}
