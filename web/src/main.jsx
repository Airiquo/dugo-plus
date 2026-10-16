import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// One import: the shared design system used by the mockups and this app alike.
import '../../styles/dugo.css'
// React-app-only additions: generic overlay/toast hooks and the KPI row utility.
import '../../styles/dugo.extras.css'
import App from './App'
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
