import { useMemo } from 'react'
import {
  getRequirementTags,
  getComponentHelps,
  getDuplicateTypes,
  COMPONENT_RULES,
} from '../data/componentRules'

function computeScore(requirements, nodes) {
  const reqs = [...(requirements.functional || []), ...(requirements.nonFunctional || [])]
  if (reqs.length === 0) return { covered: 0, total: 0, missing: [], coverage: 0 }

  const coveredReqs = new Set()
  const componentHelps = new Set()
  for (const n of nodes || []) {
    const label = n.data?.label || ''
    for (const tag of getComponentHelps(label)) componentHelps.add(tag)
  }
  for (const r of reqs) {
    const tags = getRequirementTags(r)
    if (tags.some((t) => componentHelps.has(t))) coveredReqs.add(r)
  }
  const missing = reqs.filter((r) => !coveredReqs.has(r))
  return {
    covered: coveredReqs.size,
    total: reqs.length,
    missing,
    coverage: reqs.length ? Math.round((coveredReqs.size / reqs.length) * 100) : 0,
  }
}

function computeHints(requirements, nodes) {
  const reqs = [...(requirements.functional || []), ...(requirements.nonFunctional || [])]
  const missingTags = new Set()
  const componentHelps = new Set()
  for (const n of nodes || []) {
    for (const t of getComponentHelps(n.data?.label || '')) componentHelps.add(t)
  }
  for (const r of reqs) {
    for (const t of getRequirementTags(r)) {
      if (!componentHelps.has(t)) missingTags.add(t)
    }
  }
  const tagToComponents = {}
  for (const [label, rule] of Object.entries(COMPONENT_RULES)) {
    for (const tag of rule.helps || []) {
      if (!tagToComponents[tag]) tagToComponents[tag] = []
      tagToComponents[tag].push(label)
    }
  }
  const suggestions = []
  for (const tag of missingTags) {
    const comps = tagToComponents[tag] || []
    for (const c of comps) {
      if (!nodes?.some((n) => (n.data?.label || '') === c)) {
        suggestions.push({ component: c, tag, reason: `Requires "${tag}"` })
        break
      }
    }
  }
  return suggestions.slice(0, 3)
}

function computeUnnecessary(nodes, edges, requirements) {
  const nodeIds = new Set((nodes || []).map((n) => n.id))
  const connected = new Set()
  for (const e of edges || []) {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      connected.add(e.source)
      connected.add(e.target)
    }
  }
  const componentHelps = new Set()
  const result = []

  for (const n of nodes || []) {
    const label = n.data?.label || ''
    const helps = getComponentHelps(label)
    const dupTypes = getDuplicateTypes(label)
    const sameTypeCount = (nodes || []).filter((x) => dupTypes.includes(x.data?.label || '')).length
    const marginalGain = helps.filter((h) => !componentHelps.has(h)).length
    for (const h of helps) componentHelps.add(h)

    const reasons = []
    if (!connected.has(n.id)) reasons.push('Not connected')
    if (sameTypeCount > 1 && dupTypes.length <= 2) reasons.push(`Duplicate ${label}`)
    if (marginalGain === 0 && helps.length > 0) reasons.push("Doesn't satisfy any new requirement")

    if (reasons.length > 0) {
      result.push({ id: n.id, label, reasons })
    }
  }
  return result
}

export default function GamePanel({ question, nodes, edges }) {
  const requirements = useMemo(
    () => ({
      functional: question?.functionalRequirements || [],
      nonFunctional: question?.nonFunctionalRequirements || [],
    }),
    [question]
  )

  const { covered, total, coverage, missing } = useMemo(
    () => computeScore(requirements, nodes),
    [requirements, nodes]
  )

  const hints = useMemo(() => computeHints(requirements, nodes), [requirements, nodes])
  const unnecessary = useMemo(
    () => computeUnnecessary(nodes, edges, requirements),
    [nodes, edges, requirements]
  )

  if (!question) return null

  return (
    <div className="game-panel">
      <h3 className="game-panel__title">Progress</h3>
      <div className="game-panel__score">
        <div className="game-panel__score-label">Coverage: {covered} / {total}</div>
        <div className="game-panel__progress-bar">
          <div className="game-panel__progress-fill" style={{ width: `${coverage}%` }} />
        </div>
      </div>

      {missing.length > 0 && (
        <div className="game-panel__section">
          <div className="game-panel__section-title">Missing</div>
          <ul className="game-panel__list">
            {missing.slice(0, 5).map((m, i) => (
              <li key={i}>{m.length > 80 ? m.slice(0, 77) + '…' : m}</li>
            ))}
          </ul>
        </div>
      )}

      {hints.length > 0 && (
        <div className="game-panel__section">
          <div className="game-panel__section-title">Hints</div>
          <ul className="game-panel__list game-panel__list--hints">
            {hints.map((h, i) => (
              <li key={i} title={h.reason}>
                Add <strong>{h.component}</strong> — because you have requirements about <em>{h.tag}</em>
              </li>
            ))}
          </ul>
        </div>
      )}

      {unnecessary.length > 0 && (
        <div className="game-panel__section">
          <div className="game-panel__section-title">Possibly unnecessary</div>
          <ul className="game-panel__list game-panel__list--unnecessary">
            {unnecessary.map((u) => (
              <li key={u.id}>
                <strong>{u.label}</strong>
                <span className="game-panel__reasons">
                  {u.reasons.join('; ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
