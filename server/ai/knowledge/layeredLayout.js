/**
 * PRO-level layered layout for system design diagrams.
 * Layers (horizontal bands): Edge → App → Async → Data → Observability
 * Flow separation: Write path (left) | Read path (right) for CRUD-heavy systems.
 */

const LAYER_HEIGHT = 100
const NODE_SPACING = 180
const WRITE_PATH_MAX_X = 400
const READ_PATH_OFFSET_X = 420

/** Layer 1: Edge | Layer 2: App | Layer 3: Async | Layer 4: Data | Layer 5: Observability */
const LAYER_MAP = {
  edge: 1,
  app: 2,
  async: 3,
  data: 4,
  observability: 5,
}

/** Component id -> { layer, orderWithinLayer, flow: 'write'|'read'|'shared' } */
const COMPONENT_LAYOUT = {
  dns: { layer: 1, order: 0 },
  cdn: { layer: 1, order: 1 },
  waf: { layer: 1, order: 2 },
  'edge-rate-limiter': { layer: 1, order: 3 },
  'api-gateway': { layer: 1, order: 4 },
  'load-balancer-l7': { layer: 1, order: 5 },
  'load-balancer-l4': { layer: 1, order: 6 },
  'web-app': { layer: 2, order: 0, flow: 'shared' },
  'app-service': { layer: 2, order: 1, flow: 'shared' },
  'write-api': { layer: 2, order: 1, flow: 'write' },
  'read-api': { layer: 2, order: 2, flow: 'read' },
  'auth-service': { layer: 2, order: 2 },
  'realtime-gateway': { layer: 2, order: 3, flow: 'read' },
  'presence-service': { layer: 2, order: 4, flow: 'read' },
  'conversation-service': { layer: 2, order: 5 },
  'message-service': { layer: 2, order: 6 },
  'media-service': { layer: 2, order: 7, flow: 'write' },
  'notification-service': { layer: 2, order: 8 },
  queue: { layer: 3, order: 0, flow: 'write' },
  'event-log': { layer: 3, order: 1, flow: 'write' },
  pubsub: { layer: 3, order: 2 },
  scheduler: { layer: 3, order: 3 },
  dlq: { layer: 3, order: 4 },
  worker: { layer: 3, order: 5 },
  'stream-processor': { layer: 3, order: 6 },
  'sql-db': { layer: 4, order: 0, flow: 'write' },
  'sql-read-replica': { layer: 4, order: 1, flow: 'read' },
  'kv-store': { layer: 4, order: 2 },
  'search-index': { layer: 4, order: 3 },
  'object-storage': { layer: 4, order: 4 },
  'message-store': { layer: 4, order: 5 },
  'conversation-metadata-store': { layer: 4, order: 6 },
  'document-store': { layer: 4, order: 7 },
  'data-warehouse': { layer: 4, order: 8 },
  cache: { layer: 4, order: 9, flow: 'read' },
  'cache-invalidation': { layer: 4, order: 10 },
  'time-series-db': { layer: 4, order: 11 },
  metrics: { layer: 5, order: 0 },
  logging: { layer: 5, order: 1 },
  tracing: { layer: 5, order: 2 },
  'policy-authorization': { layer: 5, order: 3 },
}

/**
 * Assign x,y positions to nodes using layered layout.
 * @param {Array} nodes - Nodes with id (or type)
 * @param {boolean} flowSeparation - If true, split write (left) vs read (right) paths
 */
export function assignLayeredPositions(nodes, flowSeparation = false) {
  const byLayer = {}
  for (const n of nodes || []) {
    const id = n.id || n.type
    const layout = COMPONENT_LAYOUT[id] || { layer: 2, order: 99 }
    const layer = layout.layer
    if (!byLayer[layer]) byLayer[layer] = []
    byLayer[layer].push({ ...n, _layout: layout })
  }

  const result = []
  for (let layer = 1; layer <= 5; layer++) {
    const list = (byLayer[layer] || []).sort((a, b) => (a._layout.order || 0) - (b._layout.order || 0))
    let writeIdx = 0
    let readIdx = 0
    let sharedIdx = 0
    list.forEach((n) => {
      const y = (layer - 1) * LAYER_HEIGHT
      let x
      if (flowSeparation && n._layout.flow === 'read') {
        x = READ_PATH_OFFSET_X + readIdx * NODE_SPACING
        readIdx++
      } else if (flowSeparation && n._layout.flow === 'write') {
        x = writeIdx * Math.min(NODE_SPACING, WRITE_PATH_MAX_X / 4)
        writeIdx++
      } else {
        if (flowSeparation) {
          x = sharedIdx * NODE_SPACING
          sharedIdx++
        } else {
          const idx = result.filter((r) => r.position?.y === y).length
          x = idx * NODE_SPACING
        }
      }
      const { _layout, ...rest } = n
      result.push({ ...rest, position: { x: Math.round(x), y } })
    })
  }
  return result
}

export { COMPONENT_LAYOUT, LAYER_MAP }
