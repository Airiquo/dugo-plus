import { useEffect, useState } from 'react'
import { listenDonorRequests, discoverWiderRequests } from '../services/donorRequests'

/** Donor request subscriptions with explicit loading and retry states. */
export function useDonorRequests(uid, radius = '25') {
  const [discovery, setDiscovery] = useState({ status: 'ready', error: '' })
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({
    status: 'loading',
    items: [],
    error: '',
  })
  useEffect(() => {
    if (!uid) return
    setState({ status: 'loading', items: [], error: '' })
    return listenDonorRequests(
      uid,
      (items) => setState({ status: 'ready', items, error: '' }),
      (error) =>
        setState((previous) => ({
          ...previous,
          status: 'error',
          error: error.message || 'Your requests could not be loaded.',
        })),
    )
  }, [uid, attempt])
  const wider = radius === '50' || radius === 'all'
  useEffect(() => {
    if (!uid || !wider) { setDiscovery({ status: 'ready', error: '' }); return }
    let active = true
    setDiscovery({ status: 'loading', error: '' })
    discoverWiderRequests().then(() => {
      if (active) setDiscovery({ status: 'ready', error: '' })
    }).catch(error => {
      if (active) setDiscovery({ status: 'error', error: error.message || 'Wider search could not be loaded.' })
    })
    return () => { active = false }
  }, [uid, wider, attempt])
  return { ...state, ...(wider && discovery.status !== 'ready' ? discovery : {}), retry: () => setAttempt((value) => value + 1) }
}
