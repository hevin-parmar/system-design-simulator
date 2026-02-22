/**
 * Elite question composer: diagram-aware, traffic-aware, escalation ladder.
 */
import { getTopicsForAction, getActionSummary } from './actionTopicMap.js'
import { retrieve } from './runtime/retriever.js'

const DIFF_KEYWORDS = {
  1: ['definition', 'when to use'],
  2: ['when to use', 'tradeoffs'],
  3: ['tradeoffs', 'failure modes', 'metrics'],
  4: ['numbers', 'qps', 'latency', 'metrics', 'operational'],
  5: ['concrete numbers', 'correctness', 'edge cases', 'rpo', 'rto'],
}

export function buildRetrievalQuery(actionSummary, userAnswer, difficulty, topic) {
  const diffKws = DIFF_KEYWORDS[Math.min(5, Math.max(1, difficulty))] || DIFF_KEYWORDS[3]
  const topics = Array.isArray(topic) ? topic : [topic]
  const parts = [actionSummary, userAnswer ? `user: ${userAnswer.slice(0, 80)}` : '', `focus: ${[...topics, ...diffKws].join(', ')}`]
  return parts.filter(Boolean).join('; ')
}

/**
 * Extract diagram context from nodes and edges.
 * If changePayload is provided (addNode), include that node in the context.
 */
export function extractDiagramContext(nodes = [], edges = [], changePayload = null) {
  let labels = (nodes || []).map((n) => ((n.data?.label || n.id || '')).toLowerCase().trim())
  if (changePayload && (changePayload.data?.label || changePayload.id)) {
    labels = [...labels, ((changePayload.data?.label || changePayload.id || '')).toLowerCase().trim()]
  }
  const hasCache = labels.some((l) => /cache|redis|memcache/.test(l))
  const hasQueue = labels.some((l) => /queue|kafka|sqs|rabbit|mq/.test(l))
  const shardCount = labels.filter((l) => /shard|partition/.test(l)).length
  const hasReplica = labels.some((l) => /replica|replication|secondary|slave/.test(l))

  const pathParts = []
  for (const e of edges || []) {
    const src = (nodes || [])?.find((n) => n.id === e.source)
    const tgt = (nodes || [])?.find((n) => n.id === e.target)
    const srcL = (src?.data?.label || src?.id || e.source || '').trim()
    const tgtL = (tgt?.data?.label || tgt?.id || e.target || '').trim()
    if (srcL && tgtL) pathParts.push(`${srcL} → ${tgtL}`)
  }
  let pathDesc = pathParts.length ? pathParts.join(', ') : null
  if (!pathDesc && labels.length) {
    const order = ['client', 'load balancer', 'lb', 'app', 'cache', 'queue', 'database', 'db', 'shard']
    const sorted = labels.filter((l) => l.length > 1).sort((a, b) => {
      const ai = order.findIndex((o) => a.includes(o) || o.includes(a))
      const bi = order.findIndex((o) => b.includes(o) || o.includes(b))
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
    })
    pathDesc = sorted.length ? sorted.join(' → ') : 'app → db'
  }
  if (!pathDesc) pathDesc = 'app → db'

  return { hasCache, hasQueue, shardCount, hasReplica, pathDesc, labels }
}

const ESCALATION = {
  1: "Explain your choice.",
  2: "What breaks first under load?",
  3: "What metric alerts you?",
  4: "What's your mitigation plan in under 5 minutes?",
  5: "What tradeoff are you explicitly accepting?",
}

const NUMERIC_ASKS = ['QPS per component', 'p99 latency target', 'TTL in seconds', 'replication lag in ms', 'retry count', 'RTO/RPO in seconds']

/**
 * Build main question with diagram context, traffic, and escalation.
 */
export function composeInterviewerQuestion({
  topic,
  chunks,
  difficulty,
  isNoOpFlag,
  userAnswer,
  diagramContext,
  trafficLoad,
  actionSummary,
}) {
  const ctx = diagramContext || extractDiagramContext([], [])
  const traffic = typeof trafficLoad === 'number' ? trafficLoad : 1000
  const diff = Math.min(5, Math.max(1, difficulty || 3))
  const needsNumbers = traffic > 100000 || diff >= 3
  const pressureMode = traffic > 200000
  const pressurePrefix = pressureMode ? "Imagine traffic spikes 3x during a launch. " : ""

  if (isNoOpFlag) {
    return {
      main: 'This change may be unnecessary — what problem does it solve?',
      why: 'Every component should map to a requirement: latency, availability, scalability, cost, or simplicity.',
      lookingFor: ['which requirement it addresses', 'how it differs from existing components', 'concrete benefit with numbers if possible'],
      followUp: null,
    }
  }

  const lookingFor = ['concrete numbers', 'explicit tradeoff', 'failure containment strategy', 'operational awareness']
  if (needsNumbers) lookingFor[0] = NUMERIC_ASKS[diff % NUMERIC_ASKS.length] || 'QPS and p99 latency'

  let main = ''
  let why = ''

  if (ctx.hasCache && (topic === 'cache' || topic === 'default')) {
    const rps = traffic >= 1000 ? `${Math.round(traffic / 1000)}K` : traffic
    main = pressurePrefix + `At ${rps} RPS, your cache sits in front of ${ctx.shardCount ? 'sharded ' : ''}DB. `
    if (ctx.shardCount) {
      main += `If one cache node fails, what happens to your primary shard? Quantify the impact on DB QPS and p99 latency.`
    } else {
      main += `If one cache node fails, what happens? Give me DB QPS impact and p99.`
    }
    why = 'Cache failures can cascade to the database.'
  } else if (ctx.hasQueue && (topic === 'queue' || topic === 'default')) {
    main = pressurePrefix + `You have a message queue in the path. `
    if (diff >= 3) {
      main += `How do you handle idempotency and duplicate processing? What about poison messages — how do you detect and contain them?`
    } else {
      main += `At-least-once or exactly-once? How do you handle duplicates?`
    }
    why = 'Delivery semantics affect correctness.'
  } else if (ctx.shardCount > 0 && (topic === 'shard' || topic === 'default')) {
    const rps = traffic >= 1000 ? `${Math.round(traffic / 1000)}K` : traffic
    main = pressurePrefix + `At ${rps} RPS with ${ctx.shardCount} shard${ctx.shardCount > 1 ? 's' : ''}, `
    main += `describe a hot-partition scenario. How would you rebalance? What about cross-shard transactions?`
    why = 'Hot partitions limit scalability.'
  } else if (ctx.hasReplica && (topic === 'database' || topic === 'default')) {
    main = pressurePrefix + `With replicas in the path, what's your replication lag? When do you get stale reads? What's your failover time?`
    why = 'Replication lag affects consistency.'
  } else if (topic === 'lb') {
    const rps = traffic >= 1000 ? `${Math.round(traffic / 1000)}K` : traffic
    main = pressurePrefix + `At ${rps} RPS, L4 or L7? What routing strategy and health check interval?`
    why = 'Affects failover and load distribution.'
  } else {
    const rps = traffic >= 1000 ? `${Math.round(traffic / 1000)}K` : traffic
    main = pressurePrefix + `Path: ${ctx.pathDesc}. ` + ESCALATION[diff]
    why = 'Shows operational depth.'
  }

  if (needsNumbers && !/quantify|qps|p99|latency|numbers?|ttl|retry|rto|rpo|replication lag|failover time/i.test(main)) {
    main += ` Give me at least one number: QPS, p99, TTL, or RTO.`
  }

  const followUp = diff >= 3 ? `If you choose that approach, what about edge cases at 2x traffic?` : null

  return { main, why, lookingFor, followUp }
}
