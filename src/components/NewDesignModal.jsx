/**
 * New Design modal: create a new system design challenge.
 * Posts to POST /api/challenges.
 */
import { useState } from 'react'
import './NewDesignModal.css'

const API_BASE = 'http://localhost:3000'

export default function NewDesignModal({ onClose, onSuccess }) {
  const [title, setTitle] = useState('')
  const [problemStatement, setProblemStatement] = useState('')
  const [scaleAssumptions, setScaleAssumptions] = useState('')
  const [functionalText, setFunctionalText] = useState('')
  const [nonFunctionalText, setNonFunctionalText] = useState('')
  const [constraintsText, setConstraintsText] = useState('')
  const [notesText, setNotesText] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [errors, setErrors] = useState([])

  const validate = () => {
    const errs = []
    if (!title?.trim()) errs.push('Title is required')
    if (!problemStatement?.trim()) errs.push('Problem Statement is required')
    if (!functionalText?.trim()) errs.push('Functional Requirements are required')
    if (!nonFunctionalText?.trim()) errs.push('Non-Functional Requirements are required')
    setErrors(errs)
    return errs.length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage(null)
    if (!validate()) return

    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          problemStatement: problemStatement.trim(),
          scaleAssumptions: scaleAssumptions.trim() || undefined,
          functionalText: functionalText.trim(),
          nonFunctionalText: nonFunctionalText.trim(),
          constraintsText: constraintsText.trim() || undefined,
          notesText: notesText.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save')
      setMessage({ type: 'success', text: 'Challenge created successfully' })
      setTimeout(() => {
        onSuccess?.(json)
        onClose?.()
      }, 500)
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal new-design-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Design</h2>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        <form className="modal-body new-design-modal__body" onSubmit={handleSubmit}>
          {errors.length > 0 && (
            <ul className="new-design-modal__errors">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          {message && (
            <div className={`new-design-modal__message new-design-modal__message--${message.type}`}>
              {message.text}
            </div>
          )}

          <div className="new-design-field">
            <label>Title <span className="required">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design a URL Shortener"
              maxLength={80}
            />
          </div>

          <div className="new-design-field">
            <label>Problem Statement <span className="required">*</span></label>
            <textarea
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              placeholder="Describe the problem to solve..."
              rows={4}
            />
          </div>

          <div className="new-design-field">
            <label>Scale Assumptions (optional)</label>
            <textarea
              value={scaleAssumptions}
              onChange={(e) => setScaleAssumptions(e.target.value)}
              placeholder="e.g. 10M DAU, 1K QPS..."
              rows={2}
            />
          </div>

          <div className="new-design-field">
            <label>Functional Requirements <span className="required">*</span></label>
            <textarea
              value={functionalText}
              onChange={(e) => setFunctionalText(e.target.value)}
              placeholder="One per line. e.g. Shorten URL, Redirect, Analytics..."
              rows={5}
            />
          </div>

          <div className="new-design-field">
            <label>Non-Functional Requirements <span className="required">*</span></label>
            <textarea
              value={nonFunctionalText}
              onChange={(e) => setNonFunctionalText(e.target.value)}
              placeholder="One per line. e.g. 99.9% availability, p99 &lt; 100ms..."
              rows={5}
            />
          </div>

          <div className="new-design-field">
            <label>Constraints (optional)</label>
            <textarea
              value={constraintsText}
              onChange={(e) => setConstraintsText(e.target.value)}
              placeholder="e.g. Single region, eventual consistency OK..."
              rows={2}
            />
          </div>

          <div className="new-design-field">
            <label>Notes (optional)</label>
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Additional context..."
              rows={2}
            />
          </div>

          <div className="new-design-modal__actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Create Challenge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
