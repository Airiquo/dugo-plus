import { AppShell, NAV } from '../../layout/AppShell'
import { PageHeader, Card } from '../../components'
/**
 * Stub page for admin screens not yet built. Shows the mockup filename and a
 * link to the live mockup served at `/mockups/*` so you can see the intended
 * look (the Vite server exposes the repo root via the `dugo-mockups` plugin)
 * while you design the real screen. The fields the screen should read or write
 * are in `docs/firestore_schema.md` §2.
 */
export default function ScreenStub({ slug }) {
  const item = NAV.find((i) => i.slug === slug) ?? { screen: `admin-${slug}`, label: slug }
  const filename = `${item.screen}.html`
  return (
    <AppShell>
      <PageHeader title={item.label} />
      <div id="page-body">
        <Card>
          <h2>Screen not built yet</h2>
          <p>
            This route points at the <code>{filename}</code> reference. Design and build the
            screen with the components in <code>web/src/components</code>, then replace this
            stub with the real page.
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
            Worked example: <code>web/src/pages/shared/Gallery.jsx</code> renders every component
            in <code>web/src/components</code> with usage notes. The collection this screen
            reads or writes is described in <code>docs/firestore_schema.md</code> §2.
          </p>
        </Card>
      </div>
    </AppShell>
  )
}
