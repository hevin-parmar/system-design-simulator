import {
  getRequirementTags,
  getComponentHelps,
  getDuplicateTypes,
  COMPONENT_RULES,
} from '../data/componentRules'

export function computeUnnecessaryNodeIds(nodes, edges) {
  const nodeIds = new Set((nodes || []).map((n) => n.id))
  const connected = new Set()
  for (const e of edges || []) {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      connected.add(e.source)
      connected.add(e.target)
    }
  }
  const componentHelps = new Set()
  const result = new Set()

  for (const n of nodes || []) {
    const label = n.data?.label || ''
    const helps = getComponentHelps(label)
    const dupTypes = getDuplicateTypes(label)
    const sameTypeCount = (nodes || []).filter((x) => dupTypes.includes(x.data?.label || '')).length
    const marginalGain = helps.filter((h) => !componentHelps.has(h)).length
    for (const h of helps) componentHelps.add(h)

    const reasons = []
    if (!connected.has(n.id)) reasons.push('Not connected')
    if (sameTypeCount > dupTypes.length) reasons.push(`Duplicate ${label}`)
    if (marginalGain === 0 && helps.length > 0) reasons.push("Doesn't satisfy any new requirement")

    if (reasons.length > 0) result.add(n.id)
  }
  return result
}
