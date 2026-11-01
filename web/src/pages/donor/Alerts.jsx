/**
 * Donor alerts inbox (F7, FR-007). Read-only: shows the match notifications the
 * matching Worker created; accepting a match is F4's screen.
 *
 * Donor chrome, matching `Profile`: the `.pub` scope with `pub-nav`, so both
 * themes carry it and the admin sidebar never shows here.
 */

import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../lib/firebase'
import { Badge } from '../../components'
import { DonorNav } from '../../layout/DonorNav'

/** `Sent` → the delivered tone; anything else is still pending. */
function toneFor(status) {
  return status === 'Sent' ? 'delivered' : 'pending'
}

export default function Alerts() {
  const { theme } = useTheme()
  const { user, loading, role, roleLoading, signOut } = useAuth()
  const [items, setItems] = useState([])
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.uid || !db) {
      setState('ready')
      return
    }
    setState('loading')
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('sentAt', 'desc'),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
        setError('')
        setState('ready')
      },
      (err) => {
        setError(err?.message || 'Alerts could not be loaded. Check your connection.')
        setState('error')
      },
    )
    return () => unsub()
  }, [user?.uid])

  if (loading || roleLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <p className="pub-msg">Checking account…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!role) return <Navigate to="/" replace />

  return (
    <div className="pub" data-theme={theme} style={{ display: 'grid', gridTemplateRows: 'auto 1fr' }}>
      <DonorNav />

      <main id="top" className="alerts-main">
        <div className="alerts-wrap">
          <p className="pub-kicker">Alerts</p>
          <h3>Match notifications</h3>
          <p className="pub-muted">
            Requests matched to your blood type. Open one to respond on the requests screen.
          </p>

          {state === 'error' ? (
            <p className="pub-msg" data-kind="error" role="alert">
              {error}
            </p>
          ) : state === 'loading' ? (
            <p className="pub-msg">Loading alerts…</p>
          ) : items.length === 0 ? (
            <p className="pub-msg" data-kind="info" role="status">
              No alerts yet. You'll be notified when a request matches your blood type.
            </p>
          ) : (
            <ul className="alerts-list">
              {items.map((item) => (
                <li key={item.id} className="alerts-item">
                  <div className="alerts-item-head">
                    <Badge data-status={toneFor(item.deliveryStatus)}>
                      {item.deliveryStatus || 'Pending'}
                    </Badge>
                    <span className="alerts-item-when">
                      {item.channel ? item.channel : 'Notification'}
                    </span>
                  </div>
                  <p className="alerts-item-text">
                    A request matched your blood type. Review it and respond from your requests
                    screen.
                  </p>
                  <p className="alerts-item-ref">Request {item.requestId}</p>
                </li>
              ))}
            </ul>
          )}

          <button
            className="pub-btn pub-btn-ghost pub-btn-wide"
            type="button"
            onClick={() => signOut()}
          >
            Sign out
          </button>
        </div>
      </main>
    </div>
  )
}
