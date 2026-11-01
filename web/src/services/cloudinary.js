import { isProfilePhotoUrl, profilePhotoProblem } from '../utils/profilePhoto.js'

const cloudName = import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME?.trim() ?? ''
const uploadPreset = import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() ?? ''

export const isCloudinaryConfigured = /^[a-zA-Z0-9_-]+$/.test(cloudName) && Boolean(uploadPreset)

/** Upload an image through the public unsigned preset; returns its HTTPS delivery URL. */
export async function uploadProfilePhoto(file, { signal } = {}) {
  const problem = profilePhotoProblem(file)
  if (problem) throw new Error(problem)
  if (!isCloudinaryConfigured) throw new Error('Photo uploads are not available yet. Please try again later.')

  const body = new FormData()
  body.append('file', file)
  body.append('upload_preset', uploadPreset)
  const timeout = AbortSignal.timeout(60000)
  let response
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST', body, signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new Error('Your photo could not be uploaded. Check your connection and try again.')
  }
  if (!response.ok) throw new Error('Your photo could not be uploaded. Try again or choose another image.')
  const result = await response.json().catch(() => null)
  const url = result?.secure_url
  if (!url || !isProfilePhotoUrl(url) || new URL(url).pathname.split('/')[1] !== cloudName || result?.resource_type !== 'image') {
    throw new Error('The photo service returned an invalid image. Please try again.')
  }
  return url
}
