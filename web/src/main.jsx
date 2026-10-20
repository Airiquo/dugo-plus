import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// One import: the shared design system used by the mockups and this app alike.
import '../../styles/dugo.css'
// React-app-only additions: generic overlay/toast hooks and the KPI row utility.
import '../../styles/dugo.extras.css'
// App-owned styling (new UI); the two above are the fixed base.
import './styles/app.css'
import App from './App'
import ErrorBoundary from './layout/ErrorBoundary'
import { installGlobalErrorReporting } from './services/log'

/**
 * The two browser-level report hooks (NFR-27) sit in an effect rather than at
 * module scope so `StrictMode`'s double invocation installs and removes them
 * cleanly instead of subscribing twice.
 */
function Root() {
  useEffect(() => installGlobalErrorReporting(), [])
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </StrictMode>,
)
