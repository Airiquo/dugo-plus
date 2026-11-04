import { flushSync } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { prefetchRoute } from '../utils/routeModules'

/** Prefetch local navigation code on intent and animate supported route changes. */
export function NavigationTransitions({ children }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const local = event => {
    const link = event.target.closest?.('a[href]')
    if (!link || link.target || link.hasAttribute('download')) return null
    const url = new URL(link.href, location.href)
    return url.origin === location.origin ? url : null
  }
  const prefetch = event => { const url = local(event); if (url) prefetchRoute(url.pathname) }
  return <div className="route-surface" onPointerOver={prefetch} onFocusCapture={prefetch} onClickCapture={event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const url = local(event)
    if (!url || url.pathname === pathname) return
    event.preventDefault()
    document.startViewTransition(() => flushSync(() => navigate(url.pathname + url.search + url.hash)))
  }}>{children}</div>
}
