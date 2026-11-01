import { AppShell } from '../../layout/AppShell'
import { useEffect, useState } from 'react'
import { Table } from '../../components/Table'
import { Drawer } from '../../components/Overlay'
import { getAuditBlocks, verifyAuditChain } from '../../services/audit'
import { cx } from '../../utils/cx'

/**
 * Audit Trail — `/admin/audit-trail`.
 *
 * Hash-chained audit log viewer for admins. Verifies chain integrity
 * and displays tamper-evident audit blocks.
 */
export default function AuditTrail() {
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)
  const [selectedBlock, setSelectedBlock] = useState(null)

  useEffect(() => {
    loadBlocks()
  }, [])

  async function loadBlocks() {
    setLoading(true)
    setError('')
    try {
      const data = await getAuditBlocks()
      setBlocks(data)
    } catch (err) {
      setError(err.message || 'Failed to load audit blocks')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify() {
    setVerifying(true)
    setVerifyResult(null)
    setError('')
    try {
      const result = await verifyAuditChain()
      setVerifyResult(result)
    } catch (err) {
      setError(err.message || 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const columns = [
    {
      key: 'sequence',
      header: 'Sequence',
      render: (row) => <span style={{ fontFamily: 'monospace' }}>{row.sequence}</span>,
    },
    {
      key: 'createdAt',
      header: 'Timestamp',
      render: (row) => {
        const date = row.createdAt?.toDate ? row.createdAt.toDate() : new Date(row.createdAt)
        return date.toLocaleString()
      },
    },
    {
      key: 'eventType',
      header: 'Event Type',
      render: (row) => <span className="pill">{row.eventType}</span>,
    },
    {
      key: 'entityType',
      header: 'Entity',
      render: (row) => row.entityType || '-',
    },
    {
      key: 'actorRole',
      header: 'Actor Role',
      render: (row) => row.actorRole || '-',
    },
    {
      key: 'correctsBlockId',
      header: 'Correction',
      render: (row) => row.correctsBlockId ? <span className="pill" data-status="warning">Links to #{row.correctsBlockId.slice(0, 8)}</span> : '-',
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button className="btn" type="button" onClick={() => setSelectedBlock(row)}>
          View
        </button>
      ),
    },
  ]

  return (
    <AppShell>
      <div id="page-header">
        <div>
          <div id="page-tag" className="k">Dugo+ admin</div>
          <h1 id="page-title">Audit Trail</h1>
        </div>
        <div id="page-actions" className="row" style={{ gap: 8 }}>
          <button className="btn" type="button" onClick={loadBlocks} disabled={loading}>
            Refresh
          </button>
          <button className="btn" type="button" onClick={handleVerify} disabled={verifying}>
            {verifying ? 'Verifying...' : 'Verify Chain'}
          </button>
        </div>
      </div>
      <div id="page-divider" className="dv"></div>
      <div id="page-body">
        {verifyResult && (
          <div className="card" style={{ marginBottom: 16, padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              Chain Verification {verifyResult.valid ? '✓ Valid' : '✗ Invalid'}
            </div>
            <div style={{ color: 'var(--d-muted)' }}>
              Blocks verified: {verifyResult.count}
              {verifyResult.brokenAt && ` | Broken at sequence: ${verifyResult.brokenAt}`}
              {verifyResult.reason && ` | ${verifyResult.reason}`}
              {verifyResult.message && ` | ${verifyResult.message}`}
            </div>
          </div>
        )}
        
        {error && (
          <div className="card" style={{ marginBottom: 16, padding: 16, color: 'var(--d-red)' }}>
            {error}
          </div>
        )}
        
        {loading ? (
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>Loading...</div>
        ) : blocks.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--d-muted)' }}>
            No audit activity has been recorded yet.
          </div>
        ) : (
          <Table columns={columns} rows={blocks} rowKey={(row) => row.id} />
        )}
      </div>

      <Drawer
        kind="drawer"
        name="audit-detail"
        open={!!selectedBlock}
        onClose={() => setSelectedBlock(null)}
        title="Audit Block Details"
      >
        {selectedBlock && (
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <div>
              <div className="k">Sequence</div>
              <div style={{ fontFamily: 'monospace' }}>{selectedBlock.sequence}</div>
            </div>
            <div>
              <div className="k">Record Hash</div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                {selectedBlock.recordHash}
              </div>
            </div>
            <div>
              <div className="k">Previous Hash</div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                {selectedBlock.prevHash}
              </div>
            </div>
            <div>
              <div className="k">Event Type</div>
              <div>{selectedBlock.eventType}</div>
            </div>
            {selectedBlock.entityType && (
              <div>
                <div className="k">Entity Type</div>
                <div>{selectedBlock.entityType}</div>
              </div>
            )}
            <div>
              <div className="k">Hashed Entity Ref</div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                {selectedBlock.hashedEntityRef || '(empty)'}
              </div>
            </div>
            <div>
              <div className="k">Hashed Actor Ref</div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                {selectedBlock.hashedActorRef || '(empty)'}
              </div>
            </div>
            {selectedBlock.actorRole && (
              <div>
                <div className="k">Actor Role</div>
                <div>{selectedBlock.actorRole}</div>
              </div>
            )}
            {selectedBlock.correctsBlockId && (
              <div>
                <div className="k">Corrects Block</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                  {selectedBlock.correctsBlockId}
                </div>
              </div>
            )}
            <div>
              <div className="k">Created At</div>
              <div>
                {selectedBlock.createdAt?.toDate
                  ? selectedBlock.createdAt.toDate().toLocaleString()
                  : new Date(selectedBlock.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </AppShell>
  )
}
