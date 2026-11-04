import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AdminDialog } from '../components/AdminDialog'
import { Btn } from '../components/Btn'
import { useLocation } from 'react-router-dom'

const ConfirmationContext = createContext(null)

/** Shared Confirm/Back prompt. An optional `action` runs with busy and retry states. */
export function ConfirmationProvider({ children }) {
  const location = useLocation()
  const pending = useRef(null)
  const [request, setRequest] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const working = useRef(false)

  const confirm = useCallback((options) => {
    if (pending.current) return Promise.resolve(false)
    return new Promise(resolve => {
      pending.current = resolve
      setError('')
      setRequest(options)
    })
  }, [])

  const finish = useCallback((result) => {
    const resolve = pending.current
    pending.current = null
    setRequest(null)
    setError('')
    resolve?.(result)
  }, [])

  const dismiss = useCallback(() => {
    if (!working.current) finish(false)
  }, [finish])

  async function accept() {
    if (working.current || !request) return
    working.current = true
    setBusy(true)
    setError('')
    try {
      await request.action?.()
      finish(true)
    } catch (failure) {
      setError(request.errorMessage || failure?.message || 'The action failed. Please try again.')
    } finally {
      working.current = false
      setBusy(false)
    }
  }

  useEffect(() => () => { pending.current?.(false); pending.current = null }, [])
  useEffect(() => { dismiss() }, [location.key, dismiss])

  return (
    <ConfirmationContext.Provider value={{ confirm, dismiss }}>
      {children}
      <AdminDialog
        name="action-confirmation"
        open={Boolean(request)}
        busy={busy}
        eyebrow="Review action"
        title={request?.title || 'Confirm action'}
        aria-describedby="action-confirmation-description"
        onClose={dismiss}
      >
        <p id="action-confirmation-description">{request?.description}</p>
        {error && <p className="pub-msg" data-kind="error" role="alert">{error}</p>}
        <div className="aa-dialog-actions">
          <Btn autoFocus disabled={busy} onClick={() => finish(false)}>Back</Btn>
          <Btn variant="primary" disabled={busy} onClick={accept}>
            {busy ? 'Working…' : request?.confirmLabel || 'Confirm'}
          </Btn>
        </div>
      </AdminDialog>
    </ConfirmationContext.Provider>
  )
}

/** Resolves false for Back/Escape, true only after confirmation and any supplied action. */
export function useConfirmation() {
  const context = useContext(ConfirmationContext)
  if (!context) throw new Error('useConfirmation must be used within ConfirmationProvider')
  return context.confirm
}

/** Cancels an unanswered confirmation when the signed-in account changes. */
export function useDismissConfirmation() {
  return useContext(ConfirmationContext).dismiss
}
