import { Component } from 'react'
import { logError } from '../services/log'

/**
 * Render-error boundary (NFR-27).
 *
 * A throw during render would otherwise blank the page with nothing reported.
 * This catches it, writes one record through `services/log.js`, and shows a
 * plain fallback with a way to recover.
 *
 * A class, because React has no hook equivalent. `children` is the whole app,
 * so the fallback is deliberately standalone rather than composed from the
 * design system, which is itself part of what may have failed.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    // The component stack is part of the report: it names what was rendering.
    logError(error, { route: window.location.pathname })
    console.error('[dugo:error]', error, info?.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          minHeight: '100vh',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
          <h1 style={{ margin: 0 }}>Something went wrong</h1>
          <p style={{ margin: 0 }}>
            This screen failed to load. The problem has been recorded.
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload the page
          </button>
        </div>
      </div>
    )
  }
}
