import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { readHospital } from '../../services/hospitals'
import {
  cancelHospitalSubscription,
  getActiveSubscription,
  getHospitalSubscriptions,
  PARTNERSHIP_PLANS,
  saveHospitalSubscription,
} from '../../services/subscriptions'
import { HospitalShell } from '../../layout/HospitalShell'
import { Badge, Btn, Card, Icon, PageHeader, Table } from '../../components'

/** The status tone for a subscription badge. */
function subscriptionTone(status) {
  if (status === 'Active') return 'active'
  if (status === 'Expired') return 'warning'
  if (status === 'Cancelled') return 'inactive'
  return 'inactive'
}

/** Formats a date for display. */
function formatDate(date) {
  if (!date) return '—'
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Hospital partnership plan management — `/hospital/plan` (FR-018, D28).
 *
 * Allows facility staff to review their active subscription, view plan features,
 * change or renew their partnership tier, and audit previous subscription cycles.
 */
export default function Plan() {
  const { profile } = useAuth()
  const hospitalId = profile?.hospitalId ?? ''

  const [hospital, setHospital] = useState(null)
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [note, setNote] = useState('')

  // Selected plan for confirmation dialog / panel
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [durationMonths, setDurationMonths] = useState(12)

  const activeSub = getActiveSubscription(subscriptions)

  const loadData = async () => {
    if (!hospitalId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadFailed(false)
    try {
      const [hosp, subs] = await Promise.all([
        readHospital(hospitalId),
        getHospitalSubscriptions(hospitalId),
      ])
      setHospital(hosp)
      setSubscriptions(subs)
    } catch {
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [hospitalId])

  const handleSelectPlan = (plan) => {
    setMessage('')
    setNote('')
    setSelectedPlan(plan)
  }

  const handleConfirmPlan = async () => {
    if (!selectedPlan) return
    setBusy(true)
    setMessage('')
    setNote('')
    try {
      await saveHospitalSubscription(hospitalId, {
        plan: selectedPlan.name,
        durationMonths: Number(durationMonths) || 12,
        existingId: activeSub?.id ?? null,
      })
      setNote(`Partnership plan successfully updated to ${selectedPlan.name}.`)
      setSelectedPlan(null)
      await loadData()
    } catch (err) {
      setMessage(err?.message || 'Failed to update partnership plan. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleCancelActive = async () => {
    if (!activeSub) return
    if (!window.confirm('Are you sure you want to cancel the active partnership plan?')) {
      return
    }
    setBusy(true)
    setMessage('')
    setNote('')
    try {
      await cancelHospitalSubscription(hospitalId, activeSub.id)
      setNote('Partnership plan cancelled.')
      await loadData()
    } catch (err) {
      setMessage(err?.message || 'Failed to cancel partnership plan.')
    } finally {
      setBusy(false)
    }
  }

  const historyColumns = [
    {
      key: 'plan',
      header: 'Plan Tier',
      render: (row) => <strong>{row.plan}</strong>,
    },
    {
      key: 'startDate',
      header: 'Start Date',
      render: (row) => formatDate(row.startDate),
    },
    {
      key: 'endDate',
      header: 'End Date / Expiry',
      render: (row) => formatDate(row.endDate),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge data-status={subscriptionTone(row.status)}>{row.status}</Badge>
      ),
    },
    {
      key: 'id',
      header: 'Reference',
      render: (row) => <code style={{ fontSize: '11px' }}>{row.id}</code>,
    },
  ]

  return (
    <HospitalShell facility={hospital?.name}>
      <div className="hospital-plan-page">
        <PageHeader
          title="Partnership Plan"
          subtitle="Manage your facility's subscription tier, features, and system access (FR-018)."
        />

        {message && (
          <p className="hospital-state" data-kind="error" role="alert">
            {message}
          </p>
        )}
        {note && (
          <p className="hospital-state" data-kind="ok" role="status">
            {note}
          </p>
        )}

        {loading ? (
          <p className="hospital-state" role="status">
            Loading subscription details…
          </p>
        ) : loadFailed ? (
          <div className="hospital-state" data-kind="error" role="alert">
            <p>Could not load partnership plans.</p>
            <Btn onClick={loadData}>Retry</Btn>
          </div>
        ) : (
          <>
            {/* Active Plan Overview */}
            <Card className="hospital-plan-active-card">
              <div className="hospital-plan-active-header">
                <div>
                  <small style={{ color: 'var(--d-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Current Access Plan
                  </small>
                  <h2 style={{ margin: '4px 0 0', fontSize: '20px' }}>
                    {activeSub ? activeSub.plan : 'No Active Plan'}
                  </h2>
                </div>
                {activeSub && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Badge data-status={subscriptionTone(activeSub.status)}>
                      {activeSub.status}
                    </Badge>
                  </div>
                )}
              </div>

              {activeSub ? (
                <div className="hospital-plan-active-details">
                  <div className="hospital-plan-meta-item">
                    <span>Active Since</span>
                    <strong>{formatDate(activeSub.startDate)}</strong>
                  </div>
                  <div className="hospital-plan-meta-item">
                    <span>Valid Until</span>
                    <strong>{formatDate(activeSub.endDate)}</strong>
                  </div>
                  <div className="hospital-plan-meta-item">
                    <span>Facility</span>
                    <strong>{hospital?.name || hospitalId}</strong>
                  </div>
                </div>
              ) : (
                <p style={{ margin: 0, color: 'var(--d-muted)' }}>
                  Your facility does not currently have an active partnership tier recorded. Select a plan below to activate system privileges.
                </p>
              )}

              {activeSub && activeSub.status === 'Active' && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
                  <Btn
                    variant="primary"
                    onClick={() => {
                      const matched = PARTNERSHIP_PLANS.find((p) => p.name === activeSub.plan)
                      handleSelectPlan(matched || PARTNERSHIP_PLANS[1])
                    }}
                  >
                    Renew or Change Plan
                  </Btn>
                  <Btn variant="ghost" onClick={handleCancelActive} disabled={busy}>
                    Cancel Subscription
                  </Btn>
                </div>
              )}
            </Card>

            {/* Plan Confirmation / Activation Drawer / Card */}
            {selectedPlan && (
              <Card className="hospital-plan-confirm-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Confirm Plan: {selectedPlan.name}</h3>
                    <p style={{ margin: '4px 0 0', color: 'var(--d-muted)', fontSize: '13px' }}>
                      {selectedPlan.description}
                    </p>
                  </div>
                  <Btn variant="ghost" onClick={() => setSelectedPlan(null)} icon="x">
                    Close
                  </Btn>
                </div>

                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', margin: '16px 0', alignItems: 'center' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--d-muted)', marginBottom: '4px' }}>
                      Duration
                    </label>
                    <select
                      className="field-input"
                      value={durationMonths}
                      onChange={(e) => setDurationMonths(Number(e.target.value))}
                      style={{ padding: '8px 12px', borderRadius: '4px', background: 'var(--card-2)', border: '1px solid var(--d-border)', color: 'inherit' }}
                    >
                      <option value={1}>1 Month</option>
                      <option value={6}>6 Months</option>
                      <option value={12}>12 Months (Annual)</option>
                    </select>
                  </div>

                  <div>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--d-muted)', marginBottom: '4px' }}>
                      Plan Rate
                    </span>
                    <strong>{selectedPlan.price}</strong>
                  </div>

                  <div>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--d-muted)', marginBottom: '4px' }}>
                      New Expiry Date
                    </span>
                    <strong>{formatDate(new Date(Date.now() + durationMonths * 30 * 86400 * 1000))}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <Btn variant="primary" onClick={handleConfirmPlan} disabled={busy}>
                    {busy ? 'Processing…' : 'Confirm & Save Plan'}
                  </Btn>
                  <Btn onClick={() => setSelectedPlan(null)} disabled={busy}>
                    Cancel
                  </Btn>
                </div>
              </Card>
            )}

            {/* Plan Tier Comparison Cards */}
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>Available Partnership Tiers</h3>
              <div className="hospital-plan-grid">
                {PARTNERSHIP_PLANS.map((plan) => {
                  const isCurrent = activeSub?.status === 'Active' && activeSub?.plan === plan.name
                  return (
                    <Card
                      key={plan.id}
                      className="hospital-plan-tier-card"
                      style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        border: plan.popular ? '1px solid var(--accent, #e53e3e)' : undefined,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              color: plan.popular ? 'var(--accent, #e53e3e)' : 'var(--d-muted)',
                              letterSpacing: '0.08em',
                            }}
                          >
                            {plan.tier}
                          </span>
                          {isCurrent && <Badge data-status="active">Current</Badge>}
                        </div>

                        <h4 style={{ margin: '8px 0 4px', fontSize: '18px' }}>{plan.name}</h4>
                        <div style={{ fontSize: '16px', fontWeight: 700, margin: '8px 0' }}>
                          {plan.price}
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--d-muted)', margin: '0 0 16px' }}>
                          {plan.description}
                        </p>

                        <div style={{ borderTop: '1px solid var(--d-border)', paddingTop: '12px', marginBottom: '16px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--d-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Included Features
                          </span>
                          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {plan.features.map((feature, idx) => (
                              <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px' }}>
                                <Icon name="check" size={14} style={{ color: 'var(--accent, #e53e3e)', marginTop: '2px', flexShrink: 0 }} />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div style={{ marginTop: '16px' }}>
                        {isCurrent ? (
                          <Btn
                            style={{ width: '100%' }}
                            onClick={() => handleSelectPlan(plan)}
                            disabled={busy}
                          >
                            Renew Plan
                          </Btn>
                        ) : (
                          <Btn
                            variant={plan.popular ? 'primary' : 'default'}
                            style={{ width: '100%' }}
                            onClick={() => handleSelectPlan(plan)}
                            disabled={busy}
                          >
                            Select Plan
                          </Btn>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Subscription History */}
            <Card style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>Subscription History</h3>
                <small style={{ color: 'var(--d-muted)' }}>
                  {subscriptions.length} record{subscriptions.length === 1 ? '' : 's'}
                </small>
              </div>

              {subscriptions.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--d-muted)', fontSize: '14px' }}>
                  No historical subscriptions found for this facility.
                </p>
              ) : (
                <Table columns={historyColumns} rows={subscriptions} rowKey={(row) => row.id} />
              )}
            </Card>
          </>
        )}
      </div>
    </HospitalShell>
  )
}
