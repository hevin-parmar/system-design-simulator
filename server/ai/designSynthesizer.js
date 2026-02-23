/**
 * Design Synthesizer: produces designPlan + diagram from structured input.
 * Uses architectural layer model for production-grade system designs.
 */
import { createFromStructured } from './agents/CreatorAgent.js'
import { normalizeTitle, titleToPackId } from '../utils/titleUtils.js'
import { loadComponents } from './knowledge/loadKnowledge.js'
import { normalizeVendorTerms } from './knowledge/vendorNormalizer.js'
import { normalizeDiagram } from './knowledge/vendorNormalizer.js'
import { validate, enrichDiagram } from './knowledge/designValidator.js'
import { assignLayeredPositions } from './knowledge/layeredLayout.js'

const COMPONENTS = loadComponents()

function getComponentById(id) {
  return COMPONENTS.find((c) => (c.id || '').toLowerCase() === (id || '').toLowerCase())
}

function buildNode(id, layerName, context) {
  const comp = getComponentById(id)
  if (!comp) return null
  const risks = Array.isArray(comp.commonFailureModes) ? comp.commonFailureModes.slice(0, 3) : []
  let scalingStrategy = 'Horizontal scaling'
  if (context.scale > 10000) {
    if (/queue|event-log|worker|pubsub/i.test(id)) scalingStrategy = 'Partition-based scale; consumers per partition'
    else if (/sql-db|kv-store|document/i.test(id)) scalingStrategy = 'Replication + sharding'
    else if (/cache|cdn/i.test(id)) scalingStrategy = 'Distributed; replication for HA'
  }
  return {
    id,
    type: id,
    label: comp.name || id,
    category: comp.category || 'compute',
    position: { x: 0, y: 0 },
    data: {
      label: comp.name || id,
      layer: layerName,
      role: comp.purpose || '',
      risks,
      scalingStrategy,
      purpose: comp.purpose || '',
    },
    details: {
      purpose: comp.purpose,
      defaults: Array.isArray(comp.knobs) ? Object.fromEntries(comp.knobs.map((k) => [k, ''])) : comp.knobs || {},
      defaultNotes: {
        what: comp.purpose || '',
        why: `Required for ${layerName} layer`,
        scalingModel: scalingStrategy,
        failureRisk: risks.join('; '),
      },
    },
    justification: { reasons: [], tradeoffs: '', failureModes: risks.join('; '), metrics: {} },
  }
}

function parseScale(constraints) {
  const rps = constraints?.rps || constraints?.traffic || ''
  const m = String(rps).match(/(\d+)\s*(k|K)?/i)
  if (!m) return 1000
  let n = parseInt(m[1], 10) || 1000
  if (m[2]) n *= 1000
  return n
}

function parseProblemType(title, problem, functional = []) {
  const t = (title + ' ' + problem + ' ' + functional.join(' ')).toLowerCase()
  if (/chat|messaging|im\s|instant\s*message/i.test(t)) return 'chat'
  if (/news\s*feed|newsfeed|feed|timeline|twitter|social\s*feed/i.test(t)) return 'newsfeed'
  if (/notification|push\s*notify|alert/i.test(t)) return 'notification'
  if (/upload|media|file|blob|image|video/i.test(t)) return 'upload'
  if (/search|discover|query/i.test(t)) return 'search'
  if (/crawl|scraper|ingest/i.test(t)) return 'crawler'
  return 'generic'
}

function buildContext(input, pack) {
  const constraints = input.constraints || {}
  const scale = parseScale(constraints)
  const problemType = parseProblemType(
    pack?.title || input.title,
    pack?.problemStatement || input.problem,
    pack?.functionalRequirements || input.functional
  )
  const functional = pack?.functionalRequirements || input.functional || []
  const nonFunctional = pack?.nonFunctionalRequirements || input.nonFunctional || []
  const allText = (pack?.title + ' ' + pack?.problemStatement + ' ' + functional.join(' ') + ' ' + nonFunctional.join(' ')).toLowerCase()
  const hasAuth = /auth|login|session|oauth|jwt/i.test(allText)
  const hasSearch = /search|find|query|discover|full.?text/i.test(allText)
  const hasMedia = /upload|media|file|image|video|blob/i.test(allText)
  const hasAsync = /queue|async|event|fanout|notification|feed|real.?time/i.test(allText)
  const readHeavy = /read|view|feed|timeline|list|browse/i.test(allText)
  return { scale, problemType, hasAuth, hasSearch, hasMedia, hasAsync, readHeavy }
}

function buildEdgeLayer(context) {
  return ['web-app', 'cdn', 'waf', 'edge-rate-limiter']
}

function buildGatewayLayer(context) {
  return ['api-gateway', 'load-balancer-l7']
}

function buildApplicationLayer(context) {
  const ids = ['auth-service', 'app-service']
  return ids
}

function buildDomainLayer(context) {
  const { problemType } = context
  const ids = []
  if (problemType === 'chat') ids.push('conversation-service', 'message-service', 'realtime-gateway', 'presence-service', 'notification-service')
  else if (problemType === 'newsfeed') ids.push('app-service')
  else if (problemType === 'notification') ids.push('notification-service')
  else if (problemType === 'upload') ids.push('media-service')
  else if (problemType === 'search') ids.push('app-service')
  else if (problemType === 'crawler') ids.push('app-service')
  else ids.push('app-service')
  return ids
}

function buildAsyncLayer(context) {
  const ids = ['queue', 'worker', 'dlq']
  if (context.hasAsync || context.problemType !== 'generic') ids.push('event-log', 'pubsub')
  return ids
}

function buildDataLayer(context) {
  const ids = ['sql-db']
  if (context.scale > 10000 || context.readHeavy) ids.push('sql-read-replica')
  if (context.problemType === 'chat') ids.push('message-store', 'conversation-metadata-store')
  else if (context.problemType === 'newsfeed' || context.problemType === 'notification') ids.push('kv-store')
  if (context.hasSearch) ids.push('search-index')
  if (context.hasMedia) ids.push('object-storage')
  if (context.scale > 10000 && context.problemType === 'generic') ids.push('kv-store')
  return ids
}

function buildCachingLayer(context) {
  const ids = []
  if (context.readHeavy || context.scale > 10000 || context.problemType === 'newsfeed' || context.problemType === 'chat') ids.push('cache')
  if (ids.includes('cache') && context.scale > 10000) ids.push('cache-invalidation')
  return ids
}

function buildObservabilityLayer() {
  return ['metrics', 'logging', 'tracing']
}

function buildBackgroundLayer(context) {
  const ids = []
  if (context.hasAsync || /batch|periodic|cron|rollup/i.test(JSON.stringify(context))) ids.push('scheduler')
  if (context.scale > 100000) ids.push('stream-processor')
  return ids
}

function buildResilienceLayer(context) {
  const ids = []
  if (context.scale > 10000) ids.push('circuit-breaker', 'retry-policy')
  return ids
}

function buildLayeredDiagram(context, pack) {
  const added = new Set()
  const nodes = []
  const edges = []

  const add = (id, layerName) => {
    if (added.has(id)) return
    const node = buildNode(id, layerName, context)
    if (node) {
      nodes.push(node)
      added.add(id)
    }
  }

  const edge = (a, b) => {
    if (added.has(a) && added.has(b)) edges.push({ source: a, target: b })
  }

  const layerFns = [
    ['edge', buildEdgeLayer],
    ['gateway', buildGatewayLayer],
    ['app', buildApplicationLayer],
    ['domain', buildDomainLayer],
    ['async', buildAsyncLayer],
    ['data', buildDataLayer],
    ['caching', buildCachingLayer],
    ['observability', buildObservabilityLayer],
    ['background', buildBackgroundLayer],
    ['resilience', buildResilienceLayer],
  ]

  for (const [layerName, fn] of layerFns) {
    for (const id of fn(context)) add(id, layerName)
  }

  if (nodes.length < 14) {
    const extras = [
      ['dns', 'edge'],
      ['policy-authorization', 'app'],
      ['scheduler', 'background'],
      ['circuit-breaker', 'resilience'],
      ['retry-policy', 'resilience'],
      ['bulkhead', 'resilience'],
    ]
    for (const [id, layer] of extras) {
      if (!added.has(id)) add(id, layer)
    }
  }

  edge('web-app', 'cdn')
  edge('web-app', 'api-gateway')
  edge('cdn', 'api-gateway')
  edge('waf', 'api-gateway')
  edge('edge-rate-limiter', 'api-gateway')
  edge('api-gateway', 'load-balancer-l7')
  edge('api-gateway', 'auth-service')
  edge('load-balancer-l7', 'app-service')
  edge('auth-service', 'app-service')
  if (added.has('conversation-service')) {
    edge('load-balancer-l7', 'conversation-service')
    edge('load-balancer-l7', 'message-service')
    edge('load-balancer-l7', 'realtime-gateway')
  }
  if (added.has('queue')) {
    edge('app-service', 'queue')
    edge('queue', 'worker')
    edge('worker', 'dlq')
  }
  if (added.has('event-log')) {
    edge('app-service', 'event-log')
    edge('event-log', 'worker')
  }
  if (added.has('sql-db')) edge('app-service', 'sql-db')
  if (added.has('sql-read-replica')) edge('sql-db', 'sql-read-replica')
  if (added.has('cache')) edge('app-service', 'cache')
  if (added.has('kv-store')) edge('app-service', 'kv-store')
  if (added.has('message-store')) {
    edge('message-service', 'message-store')
    edge('message-service', 'event-log')
  }
  if (added.has('conversation-metadata-store')) edge('conversation-service', 'conversation-metadata-store')
  if (added.has('realtime-gateway')) edge('worker', 'realtime-gateway')
  if (added.has('object-storage')) edge('app-service', 'object-storage')
  if (added.has('search-index')) edge('app-service', 'search-index')
  ;['app-service', 'message-service', 'conversation-service', 'worker', 'notification-service'].forEach((s) => {
    if (added.has(s)) edge(s, 'metrics')
  })
  if (added.has('app-service')) edge('app-service', 'logging')
  if (added.has('app-service')) edge('app-service', 'tracing')

  const isCRUDHeavy = ['newsfeed', 'chat', 'notification'].includes(context.problemType)
  const positioned = assignLayeredPositions(nodes, isCRUDHeavy)
  return { nodes: positioned, edges: [...new Map(edges.map((e) => [`${e.source}->${e.target}`, e])).values()] }
}

/**
 * Synthesize full design from structured wizard input.
 * Uses layered architectural model for production-grade diagrams.
 */
export function synthesize(input) {
  const rawTitle = input.title?.trim() || 'Untitled Design'
  const canonicalTitle = normalizeTitle(rawTitle)
  const pack = createFromStructured({
    title: canonicalTitle,
    problem: input.problemStatement?.trim() || input.problem || '',
    functional: input.functional || [],
    nonFunctional: input.nonFunctional || [],
    constraints: {
      rps: input.constraints?.traffic || input.constraints?.rps,
      storage: input.constraints?.storage,
      latency: input.constraints?.latency,
      availability: input.constraints?.availability,
    },
  }, titleToPackId(canonicalTitle))

  const context = buildContext(input, pack)
  const layeredSpec = buildLayeredDiagram(context, pack)

  const diagram = {
    nodes: layeredSpec.nodes,
    edges: layeredSpec.edges,
    notesByNodeId: {},
  }

  for (const n of diagram.nodes) {
    const comp = getComponentById(n.id)
    const d = n.data || {}
    diagram.notesByNodeId[n.id] = {
      purpose: comp?.purpose || d.role || '',
      knobs: comp?.knobs || {},
      tradeoffs: d.risks || [],
      failureModes: d.risks || comp?.commonFailureModes || [],
      interviewHooks: comp?.interviewHooks || [],
      what: d.role || comp?.purpose || '',
      why: `Required for ${d.layer || 'app'} layer`,
      scalingModel: d.scalingStrategy || 'Horizontal scaling',
      failureRisk: (d.risks || []).join('; ') || '',
    }
  }

  const normalizedDiagram = normalizeDiagram(diagram)

  const design = {
    title: pack.title,
    problemStatement: pack.problemStatement,
    functionalRequirements: pack.functionalRequirements || [],
    nonFunctionalRequirements: pack.nonFunctionalRequirements || [],
    constraints: [
      ...(input.constraints?.rps ? [`RPS: ${input.constraints.rps}`] : []),
      ...(input.constraints?.traffic ? [`Traffic: ${input.constraints.traffic}`] : []),
      ...(input.constraints?.storage ? [`Storage: ${input.constraints.storage}`] : []),
      ...(input.constraints?.latency ? [`Latency: ${input.constraints.latency}`] : []),
      ...(input.constraints?.availability ? [`Availability: ${input.constraints.availability}`] : []),
    ].filter(Boolean),
    constraintsAssumptions: pack.constraintsAssumptions || [],
  }

  let validation = validate(design, normalizedDiagram)
  let finalDiagram = normalizedDiagram

  if (validation.qualityReport?.missingCritical?.length > 0) {
    const enriched = enrichDiagram(design, finalDiagram, validation.qualityReport)
    finalDiagram = enriched
    validation = validate(design, finalDiagram)
  }

  const isCRUDHeavy = /news\s*feed|newsfeed|feed|chat|notification|timeline|twitter/i.test(
    (design.title || '') + (design.problemStatement || '')
  )
  finalDiagram.nodes = assignLayeredPositions(finalDiagram.nodes, isCRUDHeavy)

  return {
    id: pack.id,
    title: pack.title,
    problemStatement: pack.problemStatement,
    functionalRequirements: design.functionalRequirements,
    nonFunctionalRequirements: design.nonFunctionalRequirements,
    constraints: design.constraints,
    constraintsAssumptions: design.constraintsAssumptions,
    designPlan: {
      workload: {
        traffic: input.constraints?.traffic || input.constraints?.rps || 'moderate',
        storage: input.constraints?.storage || 'moderate',
        latency: input.constraints?.latency || 'p99 < 200ms',
        availability: input.constraints?.availability || '99.9%',
      },
      coreFlows: (design.functionalRequirements || []).slice(0, 6).map((f, i) => ({ id: `flow-${i + 1}`, description: f, type: 'primary' })),
      entities: ['User', 'Resource'],
      accessPatterns: [],
      risks: [],
      qualityGoals: [],
    },
    diagramSpec: {
      nodes: finalDiagram.nodes,
      edges: finalDiagram.edges,
      notesByNodeId: finalDiagram.notesByNodeId || {},
    },
    validation,
    qualityReport: validation?.qualityReport || { missingCritical: [], unnecessary: [], risks: [] },
    apiSketch: pack.apiSketch || [],
    dataModel: pack.dataModel || [],
  }
}

export { loadComponents, normalizeVendorTerms }
