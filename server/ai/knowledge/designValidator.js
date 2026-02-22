/**
 * DesignValidator: requirement coverage, unjustified nodes, duplicates.
 */
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { assignLayeredPositions } from './layeredLayout.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COMPONENTS_PATH = path.join(__dirname, 'components.json')

let componentList = []

function loadComponents() {
  if (componentList.length) return componentList
  try {
    const raw = fs.readFileSync(COMPONENTS_PATH, 'utf-8')
    const { components = [] } = JSON.parse(raw)
    componentList = components
    return componentList
  } catch (e) {
    return []
  }
}

function getAllRequirementText(design) {
  const parts = []
  const add = (arr) => {
    if (Array.isArray(arr)) arr.forEach((s) => parts.push(String(s).toLowerCase()))
  }
  add(design.functionalRequirements)
  add(design.nonFunctionalRequirements)
  add(design.constraints)
  if (design.constraintsAssumptions) add(design.constraintsAssumptions)
  if (design.problemStatement) parts.push(design.problemStatement.toLowerCase())
  return parts.join(' ')
}

function getComponentPurpose(compId) {
  const comps = loadComponents()
  const c = comps.find((x) => (x.id || '').toLowerCase() === (compId || '').toLowerCase())
  return c?.purpose || ''
}

/**
 * Build requirement coverage: each node links to justifying requirement/NFR/constraint/risk.
 */
export function buildRequirementCoverage(design, diagram) {
  const reqText = getAllRequirementText(design)
  const nodes = diagram?.nodes || []
  const coverage = []

  for (const node of nodes) {
    const id = node.id || node.type
    const purpose = getComponentPurpose(id) || node.data?.purpose || ''
    const label = (node.label || node.data?.label || id || '').toLowerCase()
    const keywords = [...new Set([
      ...id.split('-'),
      ...label.split(/\s+/),
      ...purpose.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
    ])]

    const matchedReqs = []
    const funcReqs = design.functionalRequirements || []
    const nfReqs = design.nonFunctionalRequirements || []
    const constraints = design.constraints || design.constraintsAssumptions || []

    for (let i = 0; i < funcReqs.length; i++) {
      const r = String(funcReqs[i]).toLowerCase()
      if (keywords.some((k) => r.includes(k)) || /cache|db|queue|search|storage|api|auth/i.test(r)) {
        matchedReqs.push({ type: 'functional', index: i, text: funcReqs[i] })
      }
    }
    for (let i = 0; i < nfReqs.length; i++) {
      const r = String(nfReqs[i]).toLowerCase()
      if (keywords.some((k) => r.includes(k)) || /scale|latency|availability|ha|replica/i.test(r)) {
        matchedReqs.push({ type: 'nonFunctional', index: i, text: nfReqs[i] })
      }
    }
    for (let i = 0; i < constraints.length; i++) {
      const r = String(constraints[i]).toLowerCase()
      if (keywords.some((k) => r.includes(k))) {
        matchedReqs.push({ type: 'constraint', index: i, text: constraints[i] })
      }
    }

    if (matchedReqs.length === 0 && reqText) {
      const hasGenericMatch = ['web-app', 'load-balancer-l7', 'app-service', 'sql-db', 'cache'].includes(id) ||
        /rps|qps|latency|availability|scale/i.test(reqText)
      if (hasGenericMatch) {
        matchedReqs.push({ type: 'implicit', text: 'Core infrastructure' })
      }
    }

    coverage.push({ nodeId: id, justifications: matchedReqs })
  }

  return coverage
}

/**
 * Mark nodes as core | optional | unjustified.
 */
export function validateNodes(design, diagram, coverage) {
  const nodes = diagram?.nodes || []
  const result = nodes.map((node) => {
    const id = node.id || node.type
    const cov = coverage.find((c) => c.nodeId === id)
    const justifications = cov?.justifications || []
    const hasJustification = justifications.length > 0

    const coreIds = ['web-app', 'load-balancer-l7', 'app-service', 'sql-db']
    const isCore = coreIds.includes(id)

    let status = 'optional'
    if (isCore || hasJustification) {
      status = isCore ? 'core' : 'optional'
    } else {
      status = 'unjustified'
    }

    let reason = null
    let suggestion = null
    if (status === 'unjustified') {
      reason = `No requirement or NFR clearly justifies "${id}".`
      suggestion = 'Remove this node or add a requirement/NFR that justifies it.'
    }

    return {
      nodeId: id,
      status,
      justifications: justifications.map((j) => j.text),
      reason,
      suggestion,
    }
  })

  return result
}

/**
 * Detect duplicate nodes (same purpose without stated reason).
 */
export function detectDuplicates(diagram) {
  const nodes = diagram?.nodes || []
  const byPurpose = new Map()
  const dupes = []

  for (const node of nodes) {
    const id = node.id || node.type
    const purpose = getComponentPurpose(id) || (node.data?.purpose || '').toLowerCase()
    const key = purpose || id

    if (byPurpose.has(key)) {
      const existing = byPurpose.get(key)
      if (existing.nodeId !== id) {
        dupes.push({
          nodeIds: [existing.nodeId, id],
          reason: `Both "${existing.nodeId}" and "${id}" serve similar purpose: ${purpose || 'unknown'}`,
          suggestion: 'Consider merging or document why both are needed.',
        })
      }
    } else {
      byPurpose.set(key, { nodeId: id, purpose })
    }
  }

  return dupes
}

const REQUIRED_LAYERS = {
  edge: ['web-app', 'cdn', 'waf', 'edge-rate-limiter'],
  gateway: ['api-gateway', 'load-balancer-l7'],
  app: ['app-service', 'auth-service'],
  data: ['sql-db'],
  async: ['queue', 'worker', 'dlq'],
  observability: ['metrics', 'logging'],
}

/** Default component to add per missing layer. */
const LAYER_DEFAULT = {
  edge: 'web-app',
  gateway: 'api-gateway',
  app: 'app-service',
  data: 'sql-db',
  async: 'queue',
  observability: 'metrics',
}

/** Topic-specific extra components when design is too minimal (< 10 nodes). */
const TOPIC_EXTRAS = {
  chat: ['message-store', 'cache', 'auth-service', 'dlq', 'tracing'],
  newsfeed: ['cache', 'queue', 'message-store', 'dlq', 'sql-read-replica', 'worker', 'event-log'],
  upload: ['object-storage', 'queue', 'cache', 'dlq', 'metrics', 'logging'],
  messaging: ['message-store', 'queue', 'cache', 'dlq', 'auth-service'],
  twitter: ['cache', 'message-store', 'queue', 'dlq', 'sql-read-replica'],
  notification: ['queue', 'dlq', 'worker', 'cache', 'metrics', 'logging'],
}

function getComponentById(id) {
  const comps = loadComponents()
  return comps.find((c) => (c.id || '').toLowerCase() === (id || '').toLowerCase())
}

/**
 * Enrich diagram by adding missing critical components.
 * Returns new nodes/edges/notesByNodeId.
 */
export function enrichDiagram(design, diagram, qualityReport) {
  const nodes = [...(diagram?.nodes || [])]
  const edges = [...(diagram?.edges || [])]
  const notesByNodeId = { ...(diagram?.notesByNodeId || {}) }
  const nodeIds = new Set(nodes.map((n) => n.id || n.type))
  const missingCritical = qualityReport?.missingCritical || []

  const addNode = (compId, suffix = '') => {
    if (nodeIds.has(compId + suffix)) return
    const comp = getComponentById(compId)
    const id = compId + (suffix || '')
    const label = comp?.name || compId
    nodes.push({
      id,
      type: compId,
      position: { x: 0, y: 0 },
      data: {
        label,
        purpose: comp?.purpose || '',
        source: 'enrichment',
        defaultNotes: {
          what: comp?.purpose || '',
          why: 'Added for PRO-level architecture',
          scalingModel: 'Horizontal scaling',
          failureRisk: (comp?.commonFailureModes || []).slice(0, 2).join('; ') || 'Instance failure',
        },
      },
    })
    notesByNodeId[id] = {
      purpose: comp?.purpose || '',
      knobs: comp?.knobs || {},
      tradeoffs: comp?.commonFailureModes || [],
      failureModes: comp?.commonFailureModes || [],
      interviewHooks: comp?.interviewHooks || [],
      what: comp?.purpose || '',
      why: 'Added for PRO-level architecture',
      scalingModel: 'Horizontal scaling',
      failureRisk: (comp?.commonFailureModes || []).slice(0, 2).join('; ') || 'Instance failure',
    }
    nodeIds.add(id)
  }

  const reqText = getAllRequirementText(design)
  const title = (design?.title || '').toLowerCase()
  const titleAndReqs = title + ' ' + reqText

  for (const m of missingCritical) {
    const layer = m.layer
    if (layer && LAYER_DEFAULT[layer]) addNode(LAYER_DEFAULT[layer])
  }

  if (missingCritical.some((m) => m.layer === 'minimal')) {
    for (const [topic, extras] of Object.entries(TOPIC_EXTRAS)) {
      if (new RegExp(topic, 'i').test(titleAndReqs)) {
        extras.forEach((compId) => addNode(compId))
        break
      }
    }
  }

  if (nodeIds.has('queue') && !nodeIds.has('dlq')) addNode('dlq')
  if (nodeIds.has('queue') && !nodeIds.has('worker')) addNode('worker')
  if (nodeIds.has('sql-db') && !nodeIds.has('sql-read-replica') && /feed|read|notification|chat/i.test(reqText)) addNode('sql-read-replica')
  if (!nodeIds.has('metrics')) addNode('metrics')
  if (!nodeIds.has('logging')) addNode('logging')

  const isCRUDHeavy = /news\s*feed|newsfeed|feed|chat|notification|timeline|twitter/i.test(titleAndReqs)
  const positioned = assignLayeredPositions(nodes, isCRUDHeavy)
  return { nodes: positioned, edges, notesByNodeId }
}

function buildQualityReport(design, diagram, nodeValidation, duplicates) {
  const nodeIds = new Set((diagram?.nodes || []).map((n) => n.id || n.type))
  const title = (design?.title || '').toLowerCase()
  const reqText = getAllRequirementText(design)

  const missingCritical = []
  const hasLayer = (layerIds) => {
    const nids = [...nodeIds]
    return layerIds.some((id) => nids.some((nid) => nid === id || nid.startsWith(id + '-')))
  }
  for (const [layer, ids] of Object.entries(REQUIRED_LAYERS)) {
    if (!hasLayer(ids)) {
      const msg = layer === 'observability' ? 'Missing observability (metrics, logging)' : `Missing ${layer} layer (e.g. ${ids.slice(0, 2).join(', ')})`
      missingCritical.push({ layer, message: msg })
    }
  }

  const nodeCount = nodeIds.size
  if (nodeCount < 10 && /chat|newsfeed|upload|messaging|design\s+(a\s+)?twitter|notification/i.test(title + reqText)) {
    missingCritical.push({ layer: 'minimal', message: `Design too minimal (${nodeCount} nodes) for this topic; add more components` })
  }

  const unnecessary = nodeValidation
    .filter((n) => n.status === 'unjustified')
    .map((n) => ({ nodeId: n.nodeId, reason: n.reason || 'No requirement justifies this component' }))

  const risks = []
  duplicates.forEach((d) => risks.push({ type: 'duplicate', message: d.reason }))
  if (missingCritical.length > 0) {
    missingCritical.forEach((m) => risks.push({ type: 'missing', message: m.message }))
  }

  return { missingCritical, unnecessary, risks }
}

/**
 * Full validation: coverage, status, duplicates, qualityReport.
 */
export function validate(design, diagram) {
  const coverage = buildRequirementCoverage(design, diagram)
  const nodeValidation = validateNodes(design, diagram, coverage)
  const duplicates = detectDuplicates(diagram)

  const unjustified = nodeValidation.filter((n) => n.status === 'unjustified')
  const summary = {
    totalNodes: diagram?.nodes?.length || 0,
    core: nodeValidation.filter((n) => n.status === 'core').length,
    optional: nodeValidation.filter((n) => n.status === 'optional').length,
    unjustified: unjustified.length,
    duplicates: duplicates.length,
  }

  const qualityReport = buildQualityReport(design, diagram, nodeValidation, duplicates)

  return {
    coverage,
    nodeValidation,
    duplicates,
    summary,
    qualityReport,
    valid: unjustified.length === 0 && duplicates.length === 0,
  }
}
