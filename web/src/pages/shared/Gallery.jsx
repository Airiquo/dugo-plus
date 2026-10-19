import { useState } from 'react'
import { AppShell } from '../../layout/AppShell'
import {
  PageHeader,
  Divider,
  Card,
  CardHeader,
  Chip,
  Badge,
  Pill,
  Btn,
  LinkBtn,
  Tabs,
  Field,
  Input,
  Select,
  Textarea,
  Table,
  DotMeter,
  DotRow,
  DotColumns,
  Radar,
  Modal,
  Drawer,
  Toast,
  ToastStack,
  KpiRow,
  KpiCard,
  GoogleMark,
} from '../../components'
/**
 * Gallery — renders the shipped React components and demonstrates live theme
 * switching (the app's `ThemeProvider` drives `[data-theme]` on <html>; the
 * landing `.pub` scope also accepts `data-theme`).
 *
 * Intended for development: drop in new primitives to show their markup+behaviour
 * against both themes.
 */
const SAMPLE_ROWS = [
  { id: '1', name: 'Pangasinan General', units: 24, status: 'collecting' },
  { id: '2', name: 'Batangas Regional', units: 12, status: 'urgent' },
  { id: '3', name: 'Cavite Medical', units: 40, status: 'fulfilled' },
]
const COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Facility' },
  { key: 'units', header: 'Units', cellProps: { 'data-status': 'fulfilled' } },
  {
    key: 'status',
    header: 'Status',
    render: (r) => <Chip data-status={r.status}>{r.status}</Chip>,
  },
]
export default function Gallery() {
  const [tab, setTab] = useState('list')
  const [open, setOpen] = useState(false)
  const [drawer, setDrawer] = useState(false)
  return (
    <AppShell>
      <PageHeader title="Gallery" actions={<LinkBtn to="/">Back to landing</LinkBtn>} />
      <div id="page-body" style={{ display: 'grid', gap: 16 }}>
        <Card>
          <CardHeader>Atoms</CardHeader>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <Chip>Default</Chip>
            <Chip data-status="urgent">Urgent</Chip>
            <Chip data-status="fulfilled">Fulfilled</Chip>
            <Chip data-status="collecting">Collecting</Chip>
            <Badge data-status="new">5</Badge>
            <Pill>Tagaytay City Blood Bank, Cavite</Pill>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <Btn>Default</Btn>
            <Btn variant="primary">Primary</Btn>
            <Btn variant="alert">Alert</Btn>
            <Btn variant="ghost">Ghost</Btn>
            <Btn variant="ghost">
              <GoogleMark />
              Brand mark
            </Btn>
          </div>
          <Divider />
        </Card>

        <Card>
          <CardHeader>Tabs + Fields</CardHeader>
          <Tabs
            label="Gallery tabs"
            tabs={[
              { value: 'list', label: 'List', count: '3' },
              { value: 'form', label: 'Form' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === 'form' && (
            <>
              <Field label="Label">
                <Input placeholder="Placeholder" />
              </Field>
              <Field label="Select">
                <Select
                  options={[
                    { value: 'a', label: 'Option A' },
                    { value: 'b', label: 'Option B' },
                  ]}
                />
              </Field>
              <Field label="Message" labelHidden>
                <Textarea rows={3} defaultValue="Placeholder for message" />
              </Field>
            </>
          )}
          <Table rows={SAMPLE_ROWS} columns={COLUMNS} />
        </Card>

        <Card>
          <CardHeader>KPI + Data viz</CardHeader>
          <KpiRow>
            <KpiCard
              name="kpi-gallery"
              label="Active requests"
              value="24"
              trend="up"
              trendLabel="+6 today"
              tone="green"
              values={[4, 6, 7, 8, 8, 10, 11]}
              chartLabel="Requests by day"
              live
            />
          </KpiRow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <CardHeader>Dot meter</CardHeader>
              <DotMeter value={7} total={10} label="Inventory fill: 7 of 10" />
              <DotRow label="Whole Blood" value={142} total={10} />
            </div>
            <div>
              <CardHeader>Dot columns</CardHeader>
              <DotColumns
                values={[18, 24, 21, 30, 27, 34, 29, 31]}
                labels={['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8']}
                label="Units collected — last 8 weeks"
              />
            </div>
          </div>
          <CardHeader>Radar</CardHeader>
          <Radar
            points={[
              { x: 180, y: 180, r: 3 },
              { x: 220, y: 160, hot: true },
              { x: 140, y: 200 },
            ]}
            label="Radar sample"
          />
        </Card>

        <Card>
          <CardHeader>Overlays</CardHeader>
          <div className="row" style={{ gap: 10 }}>
            <Btn variant="primary" onClick={() => setOpen(true)}>
              Open modal
            </Btn>
            <Btn onClick={() => setDrawer(true)}>Open drawer</Btn>
          </div>
        </Card>

        <ToastStack>
          <Toast>Saved successfully.</Toast>
          <Toast>3 notifications pending review.</Toast>
        </ToastStack>
      </div>

      <Modal name="gallery-modal" open={open} onClose={() => setOpen(false)} title="Example modal">
        <p style={{ margin: 0 }}>
          A reusable modal using id-suffix hooks. Backdrop clicks and Escape close it.
        </p>
        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <Btn variant="primary">Confirm</Btn>
          <Btn onClick={() => setOpen(false)}>Close</Btn>
        </div>
      </Modal>

      <Drawer
        name="gallery-drawer"
        open={drawer}
        onClose={() => setDrawer(false)}
        title="Example drawer"
      >
        <p style={{ margin: 0 }}>
          This is a right-hand drawer implemented with the same overlays stylesheet.
        </p>
        <Field label="Example field">
          <Input placeholder="..." />
        </Field>
        <Btn variant="primary" onClick={() => setDrawer(false)}>
          Done
        </Btn>
      </Drawer>
    </AppShell>
  )
}
