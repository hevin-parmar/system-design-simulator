/**
 * Generate Design Wizard: tabbed modal for structured input.
 * Calls CreatorAgent to produce requirements + baseline diagram + node notes.
 */
import { useState } from 'react'
import './DesignWizardModal.css'

const API_BASE = 'http://localhost:3000'

function ListEditor({ value, onChange, placeholder }) {
  const text = Array.isArray(value) ? value.join('\n') : (value || '')
  return (
    <textarea
      value={text}
      onChange={(e) => onChange(e.target.value.split('\n').filter(Boolean).map((s) => s.trim()))}
      placeholder={placeholder}
      rows={6}
      className="wizard-field__textarea"
    />
  )
}

export default function DesignWizardModal({ designId, onClose, onSuccess, onDesignIdNeeded }) {
  const [title, setTitle] = useState('')
  const [problemStatement, setProblemStatement] = useState('')
  const [functionalReqs, setFunctionalReqs] = useState([])
  const [nonFunctionalReqs, setNonFunctionalReqs] = useState([])
  const [trafficTarget, setTrafficTarget] = useState('')
  const [storageTarget, setStorageTarget] = useState('')
  const [latencyTarget, setLatencyTarget] = useState('')
  const [availabilityTarget, setAvailabilityTarget] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!title?.trim()) {
      setError('Title is required')
      return
    }
    setSubmitting(true)
    try {
      let dId = designId
      if (!dId && onDesignIdNeeded) {
        const res = await fetch(`${API_BASE}/api/design/new`, { method: 'POST' })
        const json = await res.json()
        dId = json.designId
      }
      const res = await fetch(`${API_BASE}/api/wizard/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designId: dId,
          title: title.trim(),
          problemStatement: problemStatement.trim(),
          functionalRequirements: functionalReqs,
          nonFunctionalRequirements: nonFunctionalReqs,
          constraints: {
            traffic: trafficTarget.trim(),
            storage: storageTarget.trim(),
            latency: latencyTarget.trim(),
            availability: availabilityTarget.trim(),
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Generate failed')
      onSuccess?.(json, json.designId || dId)
      onClose?.()
    } catch (err) {
      setError(err?.message || 'Generate failed')
    } finally {
      setSubmitting(false)
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'requirements', label: 'Requirements' },
    { id: 'constraints', label: 'Constraints' },
  ]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal design-wizard-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Generate Design (Wizard)</h2>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="design-wizard-modal__tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`design-wizard-modal__tab ${activeTab === t.id ? 'design-wizard-modal__tab--active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <form className="modal-body design-wizard-modal__body" onSubmit={handleSubmit}>
          {error && <div className="design-wizard-modal__error">{error}</div>}
          {activeTab === 'overview' && (
            <>
              <div className="wizard-field">
                <label>Title <span className="required">*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Design a URL Shortener"
                />
              </div>
              <div className="wizard-field">
                <label>Problem Statement</label>
                <textarea
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                  placeholder="Describe the problem..."
                  rows={5}
                />
              </div>
            </>
          )}
          {activeTab === 'requirements' && (
            <>
              <div className="wizard-field">
                <label>Functional Requirements (one per line)</label>
                <ListEditor
                  value={functionalReqs}
                  onChange={setFunctionalReqs}
                  placeholder="e.g. Shorten URL&#10;Redirect to original&#10;Track analytics"
                />
              </div>
              <div className="wizard-field">
                <label>Non-Functional Requirements (one per line)</label>
                <ListEditor
                  value={nonFunctionalReqs}
                  onChange={setNonFunctionalReqs}
                  placeholder="e.g. 99.9% availability&#10;p99 &lt; 100ms&#10;10M DAU"
                />
              </div>
            </>
          )}
          {activeTab === 'constraints' && (
            <>
              <div className="wizard-field">
                <label>Traffic target</label>
                <input
                  type="text"
                  value={trafficTarget}
                  onChange={(e) => setTrafficTarget(e.target.value)}
                  placeholder="e.g. 10K QPS, 1M DAU"
                />
              </div>
              <div className="wizard-field">
                <label>Storage target</label>
                <input
                  type="text"
                  value={storageTarget}
                  onChange={(e) => setStorageTarget(e.target.value)}
                  placeholder="e.g. 1TB, 100M records"
                />
              </div>
              <div className="wizard-field">
                <label>Latency target</label>
                <input
                  type="text"
                  value={latencyTarget}
                  onChange={(e) => setLatencyTarget(e.target.value)}
                  placeholder="e.g. p99 &lt; 100ms"
                />
              </div>
              <div className="wizard-field">
                <label>Availability target</label>
                <input
                  type="text"
                  value={availabilityTarget}
                  onChange={(e) => setAvailabilityTarget(e.target.value)}
                  placeholder="e.g. 99.9%, 99.99%"
                />
              </div>
            </>
          )}
          <div className="design-wizard-modal__actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Generating…' : 'Generate Design'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
