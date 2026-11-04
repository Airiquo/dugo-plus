const reads = new Map()
const subscriptions = new Map()
const MAX_AGE = 30_000

function abortError() { return new DOMException('Read cancelled.', 'AbortError') }
function withSignal(promise, signal) {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(abortError())
  return new Promise((resolve, reject) => {
    const abort = () => reject(abortError())
    signal.addEventListener('abort', abort, { once: true })
    promise.then(value => { if (!signal.aborted) resolve(value) }, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

/** Shares short-lived reads in memory; cancellation detaches this consumer. */
export function sessionRead(key, loader, { signal, fresh = false } = {}) {
  if (signal?.aborted) return Promise.reject(abortError())
  let entry = reads.get(key)
  if (fresh || !entry || entry.until < Date.now()) {
    entry = { until: Infinity }
    reads.set(key, entry)
    entry.promise = Promise.resolve().then(loader).then(value => {
      entry.until = Date.now() + MAX_AGE
      return value
    }, error => { if (reads.get(key) === entry) reads.delete(key); throw error })
    if (reads.size > 100) reads.delete(reads.keys().next().value)
  }
  return withSignal(entry.promise, signal)
}

export function invalidateSessionReads(prefix) {
  for (const key of reads.keys()) if (key.startsWith(prefix)) reads.delete(key)
}

/** One live inventory listener per facility/component, released at last unsubscribe. */
export function sessionWatch(key, start, onNext, onError) {
  let entry = subscriptions.get(key)
  if (!entry) { entry = { observers: new Set() }; subscriptions.set(key, entry) }
  const observer = { onNext, onError }
  entry.observers.add(observer)
  if ('value' in entry) onNext(entry.value)
  if (!entry.stop) entry.stop = start(value => {
    entry.value = value
    invalidateSessionReads(key)
    for (const observer of entry.observers) observer.onNext(value)
  }, error => { for (const observer of entry.observers) observer.onError?.(error) })
  return () => { entry.observers.delete(observer); if (!entry.observers.size) { entry.stop?.(); subscriptions.delete(key) } }
}

/** Called on session changes; profile/facility/stock never enters browser storage. */
export function clearSessionCache() {
  reads.clear()
  for (const entry of subscriptions.values()) entry.stop?.()
  subscriptions.clear()
}
