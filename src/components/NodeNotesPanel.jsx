/**
 * Node Notes panel: right-side drawer when a node is selected.
 * Description, common configs, tradeoffs, failure modes, interview hooks.
 * Persists in diagram state (node.data).
 */
import { useState, useEffect } from 'react'
import { COMPONENT_REGISTRY } from '../data/componentRegistry'
import './NodeNotesPanel.css'

function getTypeId(node) {
  const id = node?.id ?? ''
  const base = id.replace(/-\d+[a-z0-9]*$/, '').replace(/-[a-z0-9]{6,}$/, '')
  const known = COMPONENT_REGISTRY.map((c) => c.id)
  if (known.includes(base)) return base
  const prefix = id.split('-')[0]
  return known.includes(prefix) ? prefix : base || id
}

function NodeNotesPanel({ node, onClose, onUpdate }) {
  const [label, setLabel] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (node) {
      setLabel(node.data?.label ?? '')
      setNotes(node.data?.notes ?? '')
    }
  }, [node?.id])

  if (!node) return null

  const typeId = getTypeId(node)
  const reg = COMPONENT_REGISTRY.find((c) => c.id === typeId) || {}
  const {
    purpose,
    defaults: regDefaults,
    whenToUse,
    tradeoffs: regTradeoffs,
    failureModes: regFailureModes,
    interviewHooks: regInterviewHooks,
  } = reg

  const data = node.data ?? {}
  const configs = data.configs ?? data.defaults ?? regDefaults ?? {}
  const tradeoffs = data.tradeoffs ?? regTradeoffs ?? []
  const failureModes = data.failureModes ?? regFailureModes ?? []
  const interviewHooks = data.interviewHooks ?? regInterviewHooks ?? []
  const description = data.description ?? data.purpose ?? purpose ?? ''
  const justificationLinks = data.justificationLinks ?? []
  const nodeStatus = data.nodeStatus
  const nodeSuggestion = data.nodeSuggestion

  const hasConfigs = configs && typeof configs === 'object' && Object.keys(configs).length > 0
  const tfList = Array.isArray(tradeoffs) ? tradeoffs : []
  const fmList = Array.isArray(failureModes) ? failureModes : []
  const ihList = Array.isArray(interviewHooks) ? interviewHooks : []

  const handleSave = () => {
    onUpdate?.(node.id, {
      label: label.trim() || node.data?.label,
      notes: notes.trim(),
    })
  }

  return (
    <div className="node-notes-panel" role="dialog" aria-label="Node notes">
      <div className="node-notes-panel__header">
        <h3>Node Notes</h3>
        <button type="button" className="node-notes-panel__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="node-notes-panel__body">
        {(nodeStatus === 'unjustified' || nodeStatus === 'optional' || nodeStatus === 'core') && (
          <div className={`node-notes-panel__status node-notes-panel__status--${nodeStatus}`}>
            {nodeStatus === 'core' && 'Core'}
            {nodeStatus === 'optional' && 'Optional'}
            {nodeStatus === 'unjustified' && 'Unjustified'}
          </div>
        )}
        <div className="node-notes-panel__field">
          <label>Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleSave}
            placeholder="Component name"
          />
        </div>
        {description && (
          <div className="node-notes-panel__field">
            <label>What it does</label>
            <p className="node-notes-panel__text">{description}</p>
          </div>
        )}
        {whenToUse && (
          <div className="node-notes-panel__field">
            <label>Why it exists</label>
            <p className="node-notes-panel__text">{whenToUse}</p>
          </div>
        )}
        {hasConfigs && (
          <div className="node-notes-panel__field">
            <label>Defaults</label>
            <ul className="node-notes-panel__list">
              {Object.entries(configs).map(([k, v]) => (
                <li key={k}>
                  <code>{k}</code>: {String(v)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {tfList.length > 0 && (
          <div className="node-notes-panel__field">
            <label>Tradeoffs</label>
            <ul className="node-notes-panel__list node-notes-panel__list--bullets">
              {tfList.map((t, i) => (
                <li key={i}>{typeof t === 'string' ? t : t.text || t}</li>
              ))}
            </ul>
          </div>
        )}
        {fmList.length > 0 && (
          <div className="node-notes-panel__field">
            <label>Risks</label>
            <ul className="node-notes-panel__list node-notes-panel__list--bullets">
              {fmList.map((f, i) => (
                <li key={i}>{typeof f === 'string' ? f : f.text || f}</li>
              ))}
            </ul>
          </div>
        )}
        {justificationLinks.length > 0 && (
          <div className="node-notes-panel__field">
            <label>Justification links</label>
            <ul className="node-notes-panel__list node-notes-panel__list--bullets node-notes-panel__list--justification">
              {justificationLinks.map((j, i) => (
                <li key={i}>{typeof j === 'string' ? j : j.text || JSON.stringify(j)}</li>
              ))}
            </ul>
          </div>
        )}
        {nodeSuggestion && (
          <div className="node-notes-panel__field node-notes-panel__suggestion">
            <label>Suggestion</label>
            <p className="node-notes-panel__text">{nodeSuggestion}</p>
          </div>
        )}
        {ihList.length > 0 && (
          <div className="node-notes-panel__field">
            <label>Interview hooks</label>
            <ul className="node-notes-panel__list node-notes-panel__list--bullets node-notes-panel__list--hooks">
              {ihList.map((h, i) => (
                <li key={i}>{typeof h === 'string' ? h : h.text || h}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="node-notes-panel__field">
          <label>Your notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleSave}
            placeholder="Add your notes…"
            rows={4}
          />
        </div>
      </div>
    </div>
  )
}

export default NodeNotesPanel
