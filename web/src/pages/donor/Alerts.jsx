/**
 * Donor alerts/inbox (F7, FR-007). Read-only: displays notifications created
 * by the matching worker; accept/decline remains owned by F4.
 */

import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { AppShell } from '../../layout/AppShell'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../lib/firebase'

export default function Alerts() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.uid || !db) {
      setLoading(false)
      return
    }
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('sentAt', 'desc'),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })),
        )
        setLoading(false)
        setError('')
      },
      (err) => {
        setError(err?.message || 'Failed to load alerts')
        setLoading(false)
      },
    )
    return () => unsub()
  }, [user?.uid])

  return (
    <AppShell title="Alerts">
      <div className="donor-alerts">
        <header className="donor-alerts__header">
          <div>
            <h1 className="donor-alerts__title">Alerts</h1>
            <p className="donor-alerts__subtitle">Match notifications for your blood type</p>
          </div>
        </header>

        {loading ? <p className="donor-alerts__state">Loading alerts…</p> : null}
        {error ? <p className="donor-alerts__state donor-alerts__state--error">{error}</p> : null}
        {!loading && !error && items.length === 0 ? (
          <p className="donor-alerts__state">No alerts yet. You'll be notified when you match a request.</p>
        ) : null}

        {items.length > 0 ? (
          <div className="donor-alerts__list">
            {items.map((item) => (
              <article key={item.id} className="card donor-alerts__item">
                <div className="donor-alerts__item-header">
                  <span className="pill">Request {item.requestId}</span>
                  <span className="donor-alerts__meta">
                    {item.deliveryStatus === 'Sent' ? 'Sent' : item.deliveryStatus || 'Pending'}
                    {item.channel ? ` • ${item.channel}` : ''}
                  </span>
                </div>
                <p className="donor-alerts__text">
                  You have a potential match for request <strong>{item.requestId}</strong>.
                </p>
                <p className="donor-alerts__hint">Review and respond in Donor → Requests (F4).</p>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
