/**
 * Node Details drawer: shows when a node is selected.
 * Displays label, purpose, defaults, whenToUse; allows editing label + notes.
 */
import { useState, useEffect } from 'react'
import './NodeDetailsDrawer.css'

function NodeDetailsDrawer({ node, onClose, onUpdate }) {
  const [label, setLabel] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (node) {
      setLabel(node.data?.label ?? '')
      setNotes(node.data?.notes ?? '')
    }
  }, [node?.id])

  if (!node) return null

  const { purpose, defaults, whenToUse } = node.data ?? {}
  const hasDefaults = defaults && Object.keys(defaults).length > 0

  const handleSave = () => {
    onUpdate?.(node.id, { label: label.trim() || node.data?.label, notes: notes.trim() })
  }

  return (
    <div className="node-details-drawer" role="dialog" aria-label="Node details">
      <div className="node-details-drawer__header">
        <h3>Node Details</h3>
        <button type="button" className="node-details-drawer__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="node-details-drawer__body">
        <div className="node-details-drawer__field">
          <label>Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleSave}
            placeholder="Component name"
          />
        </div>
        {purpose && (
          <div className="node-details-drawer__field">
            <label>Purpose</label>
            <p className="node-details-drawer__text">{purpose}</p>
          </div>
        )}
        {whenToUse && (
          <div className="node-details-drawer__field">
            <label>When to use</label>
            <p className="node-details-drawer__text">{whenToUse}</p>
          </div>
        )}
        {hasDefaults && (
          <div className="node-details-drawer__field">
            <label>Default config</label>
            <ul className="node-details-drawer__defaults">
              {Object.entries(defaults).map(([k, v]) => (
                <li key={k}>
                  <code>{k}</code>: {String(v)}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="node-details-drawer__field">
          <label>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleSave}
            placeholder="Your notes…"
            rows={3}
          />
        </div>
      </div>
    </div>
  )
}

export default NodeDetailsDrawer
