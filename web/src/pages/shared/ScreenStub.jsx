import { AppShell, NAV } from '../../layout/AppShell'
import { PageHeader } from '../../components/PageHeader'
import { Card } from '../../components/Card'
/**
 * Stub page for admin screens not yet translated to React components. Shows the
 * mockup filename and a link to the live mockup served at `/mockups/*` so you
 * can compare side-by-side (the Vite server exposes the repo root via the
 * `dugo-mockups` plugin).
 */
export default function ScreenStub({ slug }) {
  const item = NAV.find((i) => i.slug === slug) ?? { screen: `admin-${slug}`, label: slug }
  const filename = `${item.screen}.html`
  return (
    <AppShell>
      <PageHeader title={item.label} />
      <div id="page-body">
        <Card>
          <h2>Screen not translated yet</h2>
          <p>
            This route is pointing to <code>{filename}</code>. Translate it by converting the
            faithful mockup markup to React (using the components in <code>web/src/components</code>
            ) and replace this stub with a real page.
          </p>
          <p>
            Open the live mockup in dev:{' '}
            <a href={`/mockups/light/${filename}`} target="_blank" rel="noreferrer">
              /mockups/light/{filename}
            </a>{' '}
            ·{' '}
            <a href={`/mockups/dark/${filename}`} target="_blank" rel="noreferrer">
              /mockups/dark/{filename}
            </a>
          </p>
          <p>
            Worked example: <code>web/src/pages/BloodRequests.jsx</code> builds a full list screen
            from the components in <code>web/src/components</code> — see{' '}
            <code>web/src/pages/Gallery.jsx</code> for usage of every component.
          </p>
        </Card>
      </div>
    </AppShell>
  )
}
