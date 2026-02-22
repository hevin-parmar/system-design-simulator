/**
 * QuestionPack JSON schema and runtime validation.
 * Enforces one-liners (<=110 chars) and field limits.
 */

const MAX_TITLE = 80
const MAX_ONELINER = 110

function truncate(s, max) {
  if (typeof s !== 'string') return ''
  if (s.length <= max) return s.trim()
  return s.slice(0, max - 1).trim() + '…'
}

function toOneLiner(s) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return truncate(t, MAX_ONELINER)
}

function ensureArray(arr, minLen = 0, maxLen = 10) {
  if (!Array.isArray(arr)) return []
  return arr.slice(0, maxLen).map((x) => (typeof x === 'string' ? toOneLiner(x) : x))
}

export function validateQuestionPack(obj) {
  const o = { ...obj }
  o.id = typeof o.id === 'string' ? o.id : `pack-${Date.now()}`
  o.title = truncate(String(o.title ?? 'Untitled Pack'), MAX_TITLE)
  o.problemStatement = String(o.problemStatement ?? '')
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join('\n')

  o.functionalRequirements = ensureArray(o.functionalRequirements, 6, 10)
  o.nonFunctionalRequirements = ensureArray(o.nonFunctionalRequirements, 6, 10)
  if (o.functionalRequirements.length === 0) o.functionalRequirements = ['User can perform core actions']
  if (o.nonFunctionalRequirements.length === 0) o.nonFunctionalRequirements = ['System should be scalable and available']
  o.constraintsAssumptions = ensureArray(o.constraintsAssumptions ?? o.constraints ?? o.assumptions ?? [], 5, 8)
  o.apiSketch = Array.isArray(o.apiSketch) ? o.apiSketch.slice(0, 6) : []
  o.dataModel = Array.isArray(o.dataModel) ? o.dataModel.slice(0, 6) : []
  o.diagramSpec = o.diagramSpec && typeof o.diagramSpec === 'object' ? o.diagramSpec : { nodes: [], edges: [] }
  o.scoringRubric = ensureArray(o.scoringRubric ?? o.rubric?.whatGoodLooksLike ?? [], 6, 10)
  o.antiPatterns = ensureArray(o.antiPatterns ?? o.rubric?.commonMistakes ?? [], 5, 8)
  o.starterHints = ensureArray(o.starterHints ?? [], 0, 6)

  for (const ep of o.apiSketch) {
    if (ep && typeof ep.purpose === 'string' && ep.purpose.length > 80) ep.purpose = truncate(ep.purpose, 80)
  }

  o.baselineDesign = o.baselineDesign && typeof o.baselineDesign === 'object'
    ? { nodes: Array.isArray(o.baselineDesign.nodes) ? o.baselineDesign.nodes : [], edges: Array.isArray(o.baselineDesign.edges) ? o.baselineDesign.edges : [] }
    : buildBaselineFromDiagramSpec(o.diagramSpec)

  o.suggestedNodes = (o.diagramSpec?.nodes ?? o.suggestedNodes ?? []).map((n) => ({
    type: n.type ?? n.id,
    label: n.label ?? n.id,
    reason: n.details?.purpose ?? '',
  }))
  o.suggestedEdges = (o.diagramSpec?.edges ?? o.suggestedEdges ?? []).map((e) => ({
    source: e.source,
    target: e.target,
  }))

  if (!o.baselineDesign?.nodes?.length && o.suggestedNodes?.length) {
    o.baselineDesign = buildBaselineFromSuggested(o.suggestedNodes, o.suggestedEdges)
  }

  return o
}

function buildBaselineFromDiagramSpec(diagramSpec) {
  const nodes = diagramSpec?.nodes ?? []
  const edges = diagramSpec?.edges ?? []
  const rn = nodes.map((n, i) => ({
    id: n.id ?? n.type ?? `node-${i}`,
    position: { x: 250, y: i * 80 },
    data: { label: n.label ?? n.id, ...(n.details || {}) },
  }))
  const re = edges.map((e, i) => ({
    id: `e-${i}-${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
  }))
  return { nodes: rn, edges: re }
}

function buildBaselineFromSuggested(suggestedNodes, suggestedEdges) {
  const nodes = (suggestedNodes || []).map((n, i) => ({
    id: n.type ?? n.id ?? `node-${i}`,
    position: { x: 250, y: i * 80 },
    data: { label: n.label ?? n.type },
  }))
  const edges = (suggestedEdges || []).map((e, i) => ({
    id: `e-${i}-${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
  }))
  return { nodes, edges }
}

export function validateQuestionPackConstraints(pack, strict = false) {
  const errs = []
  if ((pack.title || '').length > MAX_TITLE) errs.push(`title exceeds ${MAX_TITLE} chars`)
  const minFr = strict ? 6 : 1
  const minNfr = strict ? 6 : 1
  const arrs = [
    ['functionalRequirements', pack.functionalRequirements, minFr, 10],
    ['nonFunctionalRequirements', pack.nonFunctionalRequirements, minNfr, 10],
  ]
  for (const [name, arr, min, max] of arrs) {
    if (!Array.isArray(arr)) errs.push(`${name} must be array`)
    else if (arr.length < min) errs.push(`${name} needs at least ${min} items`)
    else if (arr.length > max) errs.push(`${name} max ${max} items`)
    for (const s of arr || []) {
      if (typeof s === 'string' && s.length > MAX_ONELINER) errs.push(`${name} item exceeds ${MAX_ONELINER} chars`)
    }
  }
  return errs
}
