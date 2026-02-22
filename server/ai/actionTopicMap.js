/**
 * Maps diagram actions to topics and detects no-op changes.
 */
function getNodeLabel(node) {
  return (node?.data?.label || node?.id || '').trim()
}

function normalizeLabel(label) {
  const s = String(label || '').trim().toLowerCase()
  const map = {
    'load balancer': 'lb',
    'load-balancer': 'lb',
    'message queue': 'queue',
    'message-queue': 'queue',
    'object storage': 'storage',
    'object-storage': 'storage',
  }
  return map[s] || s.replace(/\s+/g, '-')
}

/** Topic keywords for retrieval */
export const ACTION_TOPIC_MAP = {
  cache: ['caching', 'ttl', 'invalidation', 'stampede', 'consistency', 'write-through', 'write-back'],
  lb: ['load-balancing', 'health-checks', 'l4-vs-l7', 'overload', 'retries', 'routing'],
  queue: ['queue', 'delivery-semantics', 'dlq', 'idempotency', 'backpressure', 'at-least-once'],
  shard: ['sharding', 'hot-partitions', 'resharding', 'partition-key', 'replication-lag'],
  database: ['sharding', 'hot-partitions', 'replication-lag', 'failover', 'primary-replica'],
  storage: ['object-storage', 'cdn', 'cache-invalidation', 'edge'],
  cdn: ['cdn', 'cache-invalidation', 'edge', 'origin'],
  default: ['tradeoffs', 'failure-modes', 'metrics'],
}

export function getTopicFromPayload(payload) {
  const label = getNodeLabel(payload)
  const norm = normalizeLabel(label)
  if (norm.includes('cache')) return 'cache'
  if (norm.includes('load') || norm.includes('balancer') || norm === 'lb') return 'lb'
  if (norm.includes('queue') || norm.includes('mq')) return 'queue'
  if (norm.includes('shard') || norm.includes('sharding')) return 'shard'
  if (norm.includes('database') || norm.includes('db')) return 'database'
  if (norm.includes('storage') || norm.includes('s3')) return 'storage'
  if (norm.includes('cdn')) return 'cdn'
  return 'default'
}

export function getTopicsForAction(changeType, payload) {
  if (changeType === 'addNode' && payload) {
    const topic = getTopicFromPayload(payload)
    return ACTION_TOPIC_MAP[topic] || ACTION_TOPIC_MAP.default
  }
  if (changeType === 'connect' && payload) {
    return ['consistency', 'write-path', 'ordering', 'data-flow']
  }
  if (changeType === 'deleteNode' || changeType === 'deleteEdge') {
    return ['failure-modes', 'downtime', 'migration']
  }
  return ACTION_TOPIC_MAP.default
}

export function getActionSummary(changeType, payload, nodes = [], edges = []) {
  if (changeType === 'addNode' && payload) {
    const label = getNodeLabel(payload)
    return `Added ${label || 'node'}`
  }
  if (changeType === 'connect' && payload) {
    const src = payload?.source ?? payload?.sourceId ?? 'A'
    const tgt = payload?.target ?? payload?.targetId ?? 'B'
    return `Connected ${src} -> ${tgt}`
  }
  if (changeType === 'deleteNode') return 'Deleted node'
  if (changeType === 'deleteEdge') return 'Deleted edge'
  return 'Diagram change'
}

/** No-op: duplicate node type (e.g. second Cache, second Client) */
export function detectNoOp(changeType, payload, nodes = [], edges = []) {
  if (changeType !== 'addNode' || !payload) return false

  const label = getNodeLabel(payload)
  const norm = normalizeLabel(label)
  const nodeLabels = (nodes || []).map((n) => normalizeLabel(getNodeLabel(n)))

  const sameType = (l) => l === norm || (norm.length >= 3 && (l.includes(norm) || norm.includes(l)))
  const sameTypeCount = nodeLabels.filter(sameType).length

  // Duplicate: we already have this type (count >= 2 means this add creates duplicate)
  const dupes = ['client', 'cache', 'database', 'db', 'load-balancer', 'lb', 'message-queue', 'queue']
  if (sameTypeCount >= 2 && dupes.some((d) => norm.includes(d) || d.includes(norm))) return true

  return false
}

/** Dangling: node with no edges (optional strict check) */
export function isDanglingNode(nodeId, nodes, edges) {
  const hasIn = (edges || []).some((e) => e.target === nodeId)
  const hasOut = (edges || []).some((e) => e.source === nodeId)
  return !hasIn && !hasOut
}
