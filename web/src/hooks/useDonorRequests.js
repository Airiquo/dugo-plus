import { useEffect, useState } from 'react'
import { listenDonorRequests } from '../services/donorRequests'

/** Donor request subscriptions with explicit loading and retry states. */
export function useDonorRequests(uid) {
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
  return { ...state, retry: () => setAttempt((value) => value + 1) }
}
