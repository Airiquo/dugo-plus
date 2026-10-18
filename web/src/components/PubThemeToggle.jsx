import { useTheme } from '../hooks/useTheme'
import { Icon } from './Icon'
/**
 * Landing-page theme switch. Replaces the mockup's `.pub-theme` anchor (which
 * linked to the other theme's file) with an in-app toggle. `.pub-theme` styles a
 * plain button identically to the anchor.
 */
export function PubThemeToggle() {
  const { theme, toggle } = useTheme()
  const next = theme === 'light' ? 'dark' : 'light'
  return (
    <button
      type="button"
      className="pub-theme"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      <Icon name={theme === 'light' ? 'moon' : 'sun'} size={17} />
    </button>
  )
}
