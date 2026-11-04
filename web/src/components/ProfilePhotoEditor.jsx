import { useConfirmation } from '../hooks/useConfirmation'
import { useEffect, useId, useRef, useState } from 'react'
import { useAuth, userName } from '../hooks/useAuth'
import { isCloudinaryConfigured, uploadProfilePhoto } from '../services/cloudinary'
import { profilePhotoProblem } from '../utils/profilePhoto'
import { cx } from '../utils/cx'
import { Btn } from './Btn'
import { ProfileAvatar } from './ProfileAvatar'

/** Saves a photo separately from surrounding profile forms. `disabled` blocks edits while details load/save. */
export function ProfilePhotoEditor({ disabled = false, className, ...rest }) {
  const confirm = useConfirmation()
  const { user, profile, updateProfilePhoto } = useAuth()
  const id = useId()
  const input = useRef(null)
  const request = useRef(null)
  const uploaded = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!file) { setPreview(''); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => () => request.current?.abort(), [])

  const clear = () => {
    setFile(null)
    uploaded.current = null
    if (input.current) input.current.value = ''
  }
  const choose = (event) => {
    const next = event.target.files?.[0]
    if (!next) return
    const problem = profilePhotoProblem(next)
    clear()
    setError(problem)
    setNote('')
    if (!problem) setFile(next)
  }
  const save = async (remove = false) => {
    if (busy || disabled || (!remove && !file)) return
    if (remove && !await confirm({
      title: 'Remove your profile photo?',
      description: 'Your account will use initials until you choose another photo.',
      confirmLabel: 'Confirm removal',
    })) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    setNote('')
    try {
      let url = ''
      if (!remove) {
        url = uploaded.current || await uploadProfilePhoto(file, { signal: controller.signal })
        uploaded.current = url
      }
      if (controller.signal.aborted) return
      await updateProfilePhoto(url)
      if (controller.signal.aborted) return
      clear()
      setNote(remove ? 'Profile picture removed.' : 'Profile picture saved.')
    } catch (problem) {
      if (!controller.signal.aborted) setError(problem.message || 'Your picture could not be saved. Please try again.')
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return <section className={cx('profile-photo-editor', className)} aria-label="Profile picture" aria-busy={busy} {...rest}>
    <ProfileAvatar className="profile-photo-preview" src={preview || profile?.photoURL} name={profile?.fullName || userName(user)} />
    <div className="profile-photo-content">
      <h3>Profile picture <span className="muted">Optional</span></h3>
      <p id={`${id}-help`}>JPG, PNG or WebP, up to 5 MB. Choose a photo you’re comfortable sharing through a public image link.</p>
      <input ref={input} id={`${id}-file`} className="profile-photo-input" type="file" tabIndex={-1} accept="image/jpeg,image/png,image/webp" onChange={choose} disabled={disabled || busy || !isCloudinaryConfigured} aria-label="Choose profile picture" aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} aria-invalid={Boolean(error) || undefined} />
      <div className="profile-photo-actions">
        <Btn onClick={() => input.current?.click()} disabled={disabled || busy || !isCloudinaryConfigured}>{profile?.photoURL ? 'Change photo' : 'Choose photo'}</Btn>
        {file && <>
          <Btn variant="primary" onClick={() => save()} disabled={disabled || busy}>{busy ? 'Saving photo…' : 'Save photo'}</Btn>
          <Btn onClick={() => { clear(); setError(''); setNote('') }} disabled={busy}>Cancel</Btn>
        </>}
        {!file && profile?.photoURL && <Btn onClick={() => save(true)} disabled={disabled || busy}>{busy ? 'Removing…' : 'Remove photo'}</Btn>}
      </div>
      {file && <p className="profile-photo-filename">{file.name} · Preview only until you save.</p>}
      {!isCloudinaryConfigured && <p role="status">Photo uploads are not available yet. Your other profile details can still be saved.</p>}
      {error && <p id={`${id}-error`} data-state="error" role="alert">{error}</p>}
      <p className="profile-photo-status" role="status">{note || (busy ? 'Saving your profile picture…' : '')}</p>
    </div>
  </section>
}
