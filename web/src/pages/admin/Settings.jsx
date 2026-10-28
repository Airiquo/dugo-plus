import { useEffect, useState } from 'react'
import { AppShell } from '../../layout/AppShell'
import { useAuth } from '../../hooks/useAuth'
import { readSystemConfig, saveSystemConfig } from '../../services/systemConfig'
import { Btn, Card, Field, Input, PageHeader } from '../../components'

/**
 * Admin settings (FR-041).
 *
 * Read and save `systemConfig/global` (radius tiers, retry settings). Rules require
 * admin claim for writes.
 */
export default function Settings() {
  const { user } = useAuth()
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    readSystemConfig()
      .then((c) => setConfig(c || {}))
      .catch(() => setError('Could not load settings.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const set = (key) => (e) => {
    const val = e.target.value
    setConfig((prev) => ({ ...(prev || {}), [key]: val === '' ? '' : Number(val) }))
    setNote('')
    setError('')
  }

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNote('')
    try {
      await saveSystemConfig(config || {}, user?.uid)
      setNote('Settings saved.')
      load()
    } catch {
      setError('Could not save settings.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell>
      <PageHeader title="Settings" />
      <div id="page-body">
        <Card as="form" noValidate onSubmit={save}>
          <header>
            <h2>System configuration</h2>
            <p className="muted">Notification retry and matcher radius settings (`systemConfig/global`).</p>
          </header>

          {loading && <p className="muted">Loading settings…</p>}
          {error && <p data-state="error" role="alert">{error}</p>}
          {note && <p className="muted" role="status">{note}</p>}

          {!loading && (
            <>
              <Field label="Notification retry limit">
                <Input type="number" min="0" value={config?.notifRetryLimit ?? ''} onChange={set('notifRetryLimit')} />
              </Field>
              <Field label="Notification retry interval (minutes)">
                <Input type="number" min="0" value={config?.notifRetryInterval ?? ''} onChange={set('notifRetryInterval')} />
              </Field>
              <p className="muted">Radius tiers are managed via seed data (D18). This screen reads/writes `systemConfig/global` as configured.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Btn>
                <Btn onClick={load} disabled={busy}>Reload</Btn>
              </div>
            </>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
