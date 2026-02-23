/**
 * CreatorAgent: Knowledge-driven System Design Synthesizer.
 * Requirements-first, component-driven synthesis from components.json.
 */
import path from 'path'
import { fileURLToPath } from 'url'
import { generate } from '../runtime/llamaRuntime.js'
import { validateQuestionPack } from '../schemas/questionPack.js'
import { appendCreatorMemory } from '../../storage/index.js'
import { loadComponents } from '../knowledge/loadKnowledge.js'
import { normalizeVendorTerms } from '../knowledge/vendorNormalizer.js'
import { assignLayeredPositions } from '../knowledge/layeredLayout.js'
import { normalizeTitle, titleToPackId } from '../../utils/titleUtils.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Module-level cache: load components once
const COMPONENTS = loadComponents()

/** Alias for layout: write-api/read-api use app-service component data */
const COMPONENT_ALIAS = { 'write-api': 'app-service', 'read-api': 'app-service' }

const SYNONYM_MAP = (() => {
  const map = new Map()
  const ids = COMPONENTS.map((c) => (c.id || '').toLowerCase()).filter(Boolean)
  for (const c of COMPONENTS) {
    if (c.id) map.set(c.id.toLowerCase(), c.id)
    for (const s of c.synonyms || []) {
      const key = String(s).toLowerCase().trim().replace(/\s+/g, ' ')
      if (!key || map.has(key)) continue
      if (ids.some((i) => i !== key && (i.startsWith(key + '-') || i.endsWith('-' + key) || i.includes('-' + key + '-')))) continue
      map.set(key, c.id)
    }
  }
  return map
})()

/** Legacy alias for normalizeVendorTerms (used by tests). */
export function normalizeTokens(text) {
  return normalizeVendorTerms(text)
}

function getComponentById(id) {
  const alias = COMPONENT_ALIAS[(id || '').toLowerCase()]
  const lookup = alias || id
  return COMPONENTS.find((c) => (c.id || '').toLowerCase() === (lookup || '').toLowerCase())
}

const MAX_TITLE = 80
const MAX_ONELINER = 110

function truncate(s, max) {
  if (typeof s !== 'string') return ''
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : t.slice(0, max - 1).trim() + '…'
}

const FR_VERBS = /upload|view|search|follow|comment|like|message|feed|notify|create|delete|edit|share|post|send|subscribe|shorten|redirect|download|tweet|timeline|retweet|like|reply|dm|mention/i
const NFR_KEYWORDS = /latency|availability|reliability|scale|durability|consistency|throughput|performance|qps|rps|p99|99\.9|multi.?region/i

/**
 * A) Parse requirements and extract signals.
 */
function parseRequirements(text, funcReqs = [], nfReqs = [], constraints = []) {
  const t = (text || '').toLowerCase()
  const allText = [t, ...funcReqs, ...nfReqs, ...constraints].join(' ').toLowerCase()

  const extractNumber = (re) => {
    const m = allText.match(re)
    if (!m) return 0
    const num = parseInt(m[1].replace(/\D/g, ''), 10) || 0
    const hasK = /[\d]\s*k\b|[\d]k\b/i.test(m[0])
    return num * (hasK ? 1000 : 1)
  }

  const qps = extractNumber(/(\d+)\s*(?:k|K)?\s*(?:qps|rps|requests?\/sec|messages?\/sec|msg\/sec)/i) ||
    (allText.match(/100k|100,?000/i) ? 100000 : allText.match(/50k|50,?000/i) ? 50000 : extractNumber(/(\d+)\s*(?:qps|rps)/i))
  const scale = qps >= 100000 ? 'high' : qps >= 10000 ? 'medium' : qps >= 1000 ? 'moderate' : 'low'
  const multiRegion = /multi.?region|global|geo|distributed/i.test(allText)
  const latencySensitive = /latency|p99|real.?time|fast|ms/i.test(allText)
  const strongConsistency = /strong.?consistency|acid|transaction/i.test(allText)
  const eventualConsistency = /eventual|async|eventual.?consistency/i.test(allText) || !strongConsistency
  const realTime = /real.?time|websocket|live|stream|notification|feed|chat/i.test(allText)
  const batch = /batch|etl|periodic|cron|rollup|aggregat/i.test(allText)
  const durability = /durability|persist|replication|backup/i.test(allText) ? 'high' : 'standard'
  const searchReq = /search|find|query|discover|autocomplete|full.?text/i.test(allText)
  const analyticsReq = /analytics|metrics|report|bi|dashboard|aggregat/i.test(allText)
  const fanoutReq = /fanout|broadcast|notify|follow|subscri|feed|timeline|multi.?consumer/i.test(allText)
  const writeHeavy = /write.?heavy|create|post|upload|publish|insert/i.test(allText) && !/read.?heavy/i.test(allText)
  const readHeavy = /read.?heavy|view|fetch|get|read|timeline|feed/i.test(allText) || !writeHeavy

  return {
    scale,
    qps,
    multiRegion,
    latencySensitive,
    strongConsistency,
    eventualConsistency,
    realTime,
    batch,
    durability,
    searchReq,
    analyticsReq,
    fanoutReq,
    writeHeavy,
    readHeavy,
    mediaReq: /video|photo|image|upload|media|cdn|blob|file/i.test(allText),
  }
}

/**
 * B) Design expansion: add components based on requirements.
 */
function getExpansionComponents(signals, tags) {
  const ids = new Set()
  if (signals.searchReq || tags.has('search')) ids.add('search-index')
  if (/vector|embedding|semantic|similarity/i.test(JSON.stringify(signals))) ids.add('vector-index')
  if (signals.mediaReq || tags.has('media')) {
    ids.add('object-storage')
    ids.add('cdn')
  }
  if (signals.analyticsReq || tags.has('analytics')) {
    ids.add('stream-processor')
    ids.add('data-warehouse')
  }
  if (signals.fanoutReq || tags.has('async')) {
    ids.add('pubsub')
    ids.add('event-log')
  }
  return ids
}

function extractTags(text) {
  const tags = new Set()
  const map = [
    [/video|photo|image|upload|media|cdn|stream/i, 'media'],
    [/search|full.?text|autocomplete|discover/i, 'search'],
    [/chat|messaging|queue|async|real.?time|websocket|notification|feed|timeline|follow/i, 'async'],
    [/rate.?limit|throttle|limit/i, 'rate-limit'],
    [/analytics|metrics|pipeline|event|dashboard/i, 'analytics'],
    [/payment|billing|transaction/i, 'payment'],
    [/cache|invalidation|invalidate/i, 'cache'],
    [/fanout|broadcast|subscribe|notify/i, 'fanout'],
  ]
  for (const [re, tag] of map) if (re.test(text || '')) tags.add(tag)
  return tags
}

function toOneLiner(s) {
  return truncate(String(s ?? '').replace(/\s+/g, ' ').trim(), MAX_ONELINER)
}

function extractLines(block, predicate, max = 10) {
  if (!block) return []
  const clean = (s) => s.replace(/^[\s\-*•\d.)]+/, '').trim()
  return block
    .split(/\n/)
    .map(clean)
    .filter((s) => s.length >= 6 && predicate(s))
    .map(toOneLiner)
    .slice(0, max)
}

const MIN_REASONS = 2

/** Enrichment templates: component -> default FR/NFR/SCALE/FAILURE reasons when requirements match. */
const ENRICHMENT = {
  'web-app': { fr: 'User entry point for all actions', nfr: 'Required for any user-facing system', scale: null, failure: 'Single point of UX failure if down' },
  'load-balancer-l7': { fr: 'Routes HTTP requests to app instances', nfr: 'Availability and traffic distribution', scale: 'Distributes load across N instances', failure: 'SPOF if single LB; health checks route around failures' },
  'app-service': { fr: 'Business logic and request orchestration', nfr: 'Horizontal scaling of compute', scale: 'Scale instances with traffic', failure: 'Stateless; instance failure only loses in-flight requests' },
  'sql-db': { fr: 'Primary persistent storage with transactions', nfr: 'Consistency and durability', scale: 'Read replicas for read scaling', failure: 'Replication reduces data loss; failover to replica' },
  'cdn': { fr: 'Serve static/media at edge', nfr: 'Latency reduction and origin offload', scale: 'Offloads ~70–90% static traffic from origin', failure: 'Cache miss falls back to origin; stale content risk' },
  'waf': { fr: null, nfr: 'Security: blocks SQLi, XSS, bots', scale: null, failure: 'Mitigates attack traffic; false positives can block good traffic' },
  'edge-rate-limiter': { fr: null, nfr: 'Abuse protection and fairness', scale: 'Prevents overload from bursts', failure: 'Protects downstream from traffic spikes' },
  'api-gateway': { fr: 'Single API entry, auth, routing', nfr: 'Request shaping and quotas', scale: 'Centralized rate limits and routing', failure: 'SPOF; needs HA deployment' },
  'auth-service': { fr: 'Login, session, token issuance', nfr: 'Security and identity', scale: null, failure: 'Auth failure blocks all requests; needs redundancy' },
  'queue': { fr: 'Async task buffering and decoupling', nfr: 'Smooths traffic spikes', scale: 'Buffers writes; ~10K+ msg/sec per partition', failure: 'Backlog growth if consumer slow; DLQ for poison msgs' },
  'worker': { fr: 'Background processing of async jobs', nfr: 'Decouples sync path from heavy work', scale: 'Scale workers with queue depth', failure: 'At-least-once; idempotency required' },
  'event-log': { fr: 'Event streaming, replay, fanout', nfr: 'High-throughput ordered ingest', scale: 'Partitioned; 100K+ events/sec', failure: 'Consumer lag; hot partition; rebalancing' },
  'pubsub': { fr: 'Fanout to multiple subscribers', nfr: 'Decouples publishers from consumers', scale: 'Broadcast to N subscribers without N writes', failure: 'Slow consumer blocks others; use push/pull' },
  'search-index': { fr: 'Full-text search and discovery', nfr: 'Query performance at scale', scale: 'Sharded index; sub-100ms queries', failure: 'Stale index; high write amplification' },
  'object-storage': { fr: 'Blob/media/file storage', nfr: 'Durability and cost-efficiency', scale: 'Unlimited storage; multipart uploads', failure: 'Eventual consistency; prefix hot spots' },
  'sql-read-replica': { fr: null, nfr: 'Read scaling; offload primary', scale: 'Routes ~80% reads to replicas at 300K RPS', failure: 'Replication lag; stale reads; failover complexity' },
  'kv-store': { fr: 'Low-latency key lookups (sessions, counters)', nfr: 'Horizontal sharding', scale: 'Partition key design; hot key mitigation', failure: 'Hot keys; uneven partitions' },
  'cache': { fr: 'Fast reads for hot data', nfr: 'Latency and DB load reduction', scale: '80% cache hit → 20% DB load at 300K RPS', failure: 'Stampede on miss; stale data; cache node failure' },
  'cache-invalidation': { fr: 'Propagate invalidation events', nfr: 'Cache freshness', scale: null, failure: 'Missed invalidations cause stale reads' },
  'stream-processor': { fr: 'Real-time aggregation and enrichment', nfr: 'Stream analytics', scale: 'Windowed processing; checkpointing', failure: 'Late events; state blowup; checkpoint lag' },
  'data-warehouse': { fr: 'BI queries and analytics', nfr: 'Columnar scan performance', scale: 'Partitioned scans', failure: 'Expensive scans; stale materializations' },
  'metrics': { fr: null, nfr: 'Monitoring and alerting', scale: null, failure: 'High cardinality costs; missing metrics' },
  'logging': { fr: null, nfr: 'Debugging and audit trail', scale: null, failure: 'PII leakage; cost explosion' },
  'tracing': { fr: null, nfr: 'Distributed trace for latency debugging', scale: null, failure: 'Sampling hides tail latencies' },
  'circuit-breaker': { fr: null, nfr: 'Prevent cascading failures', scale: null, failure: 'Stops calling failing deps; fallback required' },
  'retry-policy': { fr: null, nfr: 'Transient failure handling', scale: null, failure: 'Retry storms if not bounded; idempotency required' },
  'scheduler': { fr: 'Periodic jobs, cleanup, rollups', nfr: 'Batch processing', scale: null, failure: 'Double-run without locking; missed runs' },
  'document-store': { fr: 'Flexible schema documents', nfr: 'Schema evolution', scale: 'Sharding by doc id', failure: 'Query without index; hot partitions' },
  'dlq': { fr: null, nfr: 'Isolate poison messages', scale: null, failure: 'Unblocks pipeline; manual triage required' },
  'dns': { fr: 'Route users to endpoint', nfr: 'Geo routing, failover', scale: null, failure: 'Stale TTL; misconfigured routing' },
  'vector-index': { fr: 'Semantic/similarity search', nfr: 'ANN query performance', scale: null, failure: 'Embedding drift; rebuild cost' },
  'bulkhead': { fr: null, nfr: 'Resource isolation per dependency', scale: null, failure: 'Prevents one failure from exhausting pool' },
  'config-service': { fr: null, nfr: 'Dynamic config distribution', scale: null, failure: 'Bad rollout; stale config' },
  'feature-flag': { fr: null, nfr: 'Controlled rollout and kill-switch', scale: null, failure: 'Flag outage; inconsistent caches' },
  'policy-authorization': { fr: 'Access control decisions', nfr: 'RBAC/ABAC enforcement', scale: null, failure: 'Policy drift; over-broad permissions' },
  'time-series-db': { fr: 'Metrics/events over time', nfr: 'Rollups and retention', scale: null, failure: 'High cardinality; ingest bottleneck' },
  'realtime-gateway': { fr: 'WebSocket connections for real-time delivery', nfr: 'Low-latency bidirectional messaging', scale: 'Sticky sessions; scale by connection count', failure: 'Connection storms on reconnect; stale after failover' },
  'presence-service': { fr: 'Online/offline status, typing indicators', nfr: 'Real-time presence at scale', scale: 'Shard by user; heartbeat TTL', failure: 'Stale presence after crash; hot keys for popular users' },
  'conversation-service': { fr: 'Conversation metadata, list threads', nfr: 'Efficient list-by-user queries', scale: 'Index on user+lastMessage', failure: 'N+1 on list; hot partitions' },
  'message-service': { fr: 'Send/receive messages, fanout to pipelines', nfr: 'Ordering and idempotency', scale: 'Partition by conversation', failure: 'Duplicates without idempotency; ordering breaks' },
  'message-store': { fr: 'Durable message storage', nfr: 'Sharded write scale', scale: 'Partition by conversationId or (convId, msgId)', failure: 'Hot partition for popular convs; uneven shards' },
  'conversation-metadata-store': { fr: 'Participants, last message, read receipts', nfr: 'List conversations per user', scale: 'Index + cache', failure: 'Hot rows; eventual consistency' },
  'notification-service': { fr: 'Push notifications to offline users', nfr: 'APNs/FCM delivery', scale: 'Batch; retry with backoff', failure: 'Token expiry; provider rate limits' },
  'media-service': { fr: 'Upload, transcoding, thumbnails', nfr: 'Presigned uploads; async processing', scale: 'Object storage + CDN', failure: 'Upload timeout; transcoding backlog' },
}

function buildJustification(compId, funcReqs, nfReqs, constraints, comp, signals) {
  const reasons = []
  const purpose = (comp?.purpose || '').toLowerCase()
  const qps = signals?.qps || 0
  const enrich = ENRICHMENT[compId]

  const addFr = (text) => { if (text && !reasons.some((r) => r.type === 'FR')) reasons.push({ type: 'FR', text }) }
  const addNfr = (text) => { if (text && !reasons.some((r) => r.type === 'NFR')) reasons.push({ type: 'NFR', text }) }
  const addScale = (text) => { if (text && !reasons.some((r) => r.type === 'SCALE')) reasons.push({ type: 'SCALE', text }) }
  const addFailure = (text) => { if (text && !reasons.some((r) => r.type === 'FAILURE_MITIGATION')) reasons.push({ type: 'FAILURE_MITIGATION', text }) }

  for (const fr of funcReqs || []) {
    const frLo = String(fr).toLowerCase()
    if (/search|find|query|discover|autocomplete/i.test(frLo) && /search|index|query/i.test(purpose)) addFr(fr)
    if (/upload|store|save|file|media|image|video|blob/i.test(frLo) && /object|storage|blob|cdn/i.test(purpose)) addFr(fr)
    if (/message|notify|event|async|queue|stream|feed|timeline|follow|post|tweet/i.test(frLo) && /queue|event|stream|pubsub/i.test(purpose)) addFr(fr)
    if (/auth|login|session|token/i.test(frLo) && /auth|token|session/i.test(purpose)) addFr(fr)
    if (/cache|fast|read|view|fetch|timeline|feed/i.test(frLo) && /cache|read/i.test(purpose)) addFr(fr)
    if (/follow|fanout|broadcast|subscribe/i.test(frLo) && /pubsub|event|fanout/i.test(purpose)) addFr(fr)
    if (/post|create|tweet|reply|retweet|like/i.test(frLo) && /app|service|business/i.test(purpose)) addFr(fr)
  }

  for (const nfr of nfReqs || []) {
    const nfrLo = String(nfr).toLowerCase()
    if (/latency|p99|performance|fast/i.test(nfrLo) && /cache|cdn|reduce/i.test(purpose)) addNfr(nfr)
    if (/availability|99\.9|ha|replica/i.test(nfrLo) && /replica|load|scale/i.test(purpose)) addNfr(nfr)
    if (/scale|throughput|qps|rps/i.test(nfrLo)) addNfr(nfr)
    if (/rate.?limit|throttle|abuse/i.test(nfrLo) && /rate|limit|throttle/i.test(purpose)) addNfr(nfr)
    if (/security|waf|attack/i.test(nfrLo) && /waf|security|block/i.test(purpose)) addNfr(nfr)
  }

  for (const c of constraints || []) {
    const cLo = String(c).toLowerCase()
    if (/rps|qps|traffic|latency|availability/i.test(cLo)) addNfr(c)
  }

  if (qps >= 100000 && /scale|partition|shard|queue|cache|replica|load/i.test(purpose)) {
    addScale(`Traffic ${qps.toLocaleString()} RPS requires this component for scale`)
  }
  if (enrich?.scale && qps >= 10000) addScale(enrich.scale)
  if (enrich?.failure) addFailure(enrich.failure)

  if (reasons.length < MIN_REASONS && enrich) {
    if (!reasons.some((r) => r.type === 'FR') && enrich.fr) addFr(enrich.fr)
    if (!reasons.some((r) => r.type === 'NFR') && enrich.nfr) addNfr(enrich.nfr)
    if (!reasons.some((r) => r.type === 'SCALE') && enrich.scale && qps >= 1000) addScale(enrich.scale)
    if (!reasons.some((r) => r.type === 'FAILURE_MITIGATION') && enrich.failure) addFailure(enrich.failure)
  }

  if (reasons.length < MIN_REASONS) return null

  const failureModes = comp?.commonFailureModes || []
  const tradeoffs = Array.isArray(failureModes) ? failureModes.join('; ') : String(failureModes || '')

  let expectedLoad = ''
  let latencyImpact = ''
  let scaleThreshold = ''
  if (qps > 0) {
    if (/cache|cdn/i.test(purpose)) {
      expectedLoad = `~${Math.round(qps * 0.7)}–${Math.round(qps * 0.9)} RPS served from cache/CDN`
      latencyImpact = 'Reduces p99 by 50–80% for cache hits'
      scaleThreshold = '10K+ RPS read-heavy benefits from cache'
    } else if (/sql-read-replica|replica/i.test(purpose)) {
      expectedLoad = `~${Math.round(qps * 0.8)} reads offloaded from primary`
      latencyImpact = 'Reduces primary load; replication lag adds latency'
      scaleThreshold = '10K+ reads/sec'
    } else if (/queue|event|worker/i.test(purpose)) {
      expectedLoad = `Async path handles write spikes; ${qps} RPS total`
      latencyImpact = 'Decouples sync latency from background work'
      scaleThreshold = '10K+ writes/sec'
    } else if (/load|balance/i.test(purpose)) {
      expectedLoad = `Distributes ${qps} RPS across instances`
      latencyImpact = 'Health checks route around slow/failed instances'
      scaleThreshold = 'Any multi-instance deployment'
    }
  }

  const metrics = {
    expectedLoad: expectedLoad || undefined,
    latencyImpact: latencyImpact || undefined,
    scaleThreshold: scaleThreshold || (qps >= 10000 ? `${qps.toLocaleString()} RPS` : undefined),
  }

  return {
    reasons,
    tradeoffs: tradeoffs || undefined,
    failureModes: Array.isArray(failureModes) ? failureModes.join('; ') : undefined,
    metrics: Object.fromEntries(Object.entries(metrics).filter(([, v]) => v)),
  }
}

/** Notes template per component for reference-grade designs (purpose, keyDecisions, failureModes). */
const NODE_NOTES = {
  'api-gateway': { keyDecisions: ['Route by path/version; validate auth before backend', 'Centralize rate limits and request shaping'], failureModes: ['SPOF; deploy HA with health checks', 'Misconfigured routes cause 404/5xx'] },
  'edge-rate-limiter': { keyDecisions: ['Token bucket or sliding window per user/IP', 'Distributed state (Redis) for global limits'], failureModes: ['Hot keys on limiter storage', 'Incorrect keying causes unfair limits'] },
  'auth-service': { keyDecisions: ['JWT vs session; token refresh flow', 'Validate on gateway or service mesh'], failureModes: ['Token replay if not bound to request', 'Session store overload'] },
  'realtime-gateway': { keyDecisions: ['Sticky sessions for WebSocket affinity', 'Heartbeat/keepalive to detect dead connections'], failureModes: ['Connection storms on mass reconnect', 'Stale connections after instance failover'] },
  'presence-service': { keyDecisions: ['Heartbeat TTL; sliding window for last-seen', 'Shard by userId for scale'], failureModes: ['Stale presence after client crash', 'Hot keys for popular users'] },
  'conversation-service': { keyDecisions: ['Index (userId, lastMessageTs) for list', 'Cache hot conversation metadata'], failureModes: ['N+1 queries on list', 'Hot partitions for active threads'] },
  'message-service': { keyDecisions: ['Idempotency key per message; partition by conversationId', 'Fanout: event-log for realtime, queue for push'], failureModes: ['Duplicate messages without idempotency', 'Ordering breaks under partition rebalance'] },
  'message-store': { keyDecisions: ['Partition key: conversationId; sort key: messageId or timestamp', 'Wide-column or KV; TTL for retention'], failureModes: ['Hot partition for viral threads', 'Uneven shard distribution'] },
  'conversation-metadata-store': { keyDecisions: ['Document or SQL; index for list-by-user', 'Eventual consistency for read receipts OK'], failureModes: ['Hot rows for active conversations', 'Read-after-write consistency gaps'] },
  'event-log': { keyDecisions: ['Partition by conversationId for ordering', 'Retention policy; compaction for deletes'], failureModes: ['Hot partition; consumer lag', 'Rebalancing storms'] },
  'worker': { keyDecisions: ['Idempotent processing; DLQ for poison', 'Retry: exponential backoff, max retries, DLQ on exhaust'], failureModes: ['Poison messages block partition', 'Retry storms without backoff'] },
  'dlq': { keyDecisions: ['Max retries before DLQ; alert on depth', 'Manual triage and redrive'], failureModes: ['Silent accumulation without monitoring', 'Reprocessing without fix'] },
  'notification-service': { keyDecisions: ['Batch payloads; retry with exponential backoff', 'Refresh device tokens periodically'], failureModes: ['Token expiry causes silent drops', 'Provider rate limits'] },
  'object-storage': { keyDecisions: ['Presigned URLs for direct upload', 'Lifecycle policies for archival'], failureModes: ['Eventual consistency edge cases', 'Hot prefix for popular media'] },
  'cdn': { keyDecisions: ['Cache media by content hash or path', 'Purge on update; stale-while-revalidate'], failureModes: ['Cache poisoning', 'Origin overload on miss spike'] },
  'media-service': { keyDecisions: ['Async transcoding; store original + variants', 'Thumbnail generation pipeline'], failureModes: ['Upload timeout for large files', 'Transcoding backlog'] },
  'cache': { keyDecisions: ['Cache-aside for conversation/metadata', 'TTL + invalidation stream for freshness'], failureModes: ['Stampede on miss', 'Stale data after write'] },
  'metrics': { keyDecisions: ['Cardinality guards; sample high-volume metrics', 'SLI/SLO dashboards'], failureModes: ['High cardinality costs', 'Missing metrics'] },
  'logging': { keyDecisions: ['Structured JSON; correlation IDs', 'Sampling for high-volume paths'], failureModes: ['PII leakage', 'Cost explosion'] },
  'tracing': { keyDecisions: ['Sample 1–10% of requests', 'Propagate trace context across services'], failureModes: ['Missing propagation', 'Sampling hides tail latencies'] },
}

function buildNode(id, comp, j, details = {}) {
  const knobs = Array.isArray(comp.knobs) ? {} : (comp.knobs || {})
  if (Array.isArray(comp.knobs)) {
    for (const k of comp.knobs) if (typeof k === 'string') knobs[k] = ''
  }
  const notes = NODE_NOTES[id] || {
    keyDecisions: [(comp.knobs || [])[0] ? `Configure ${(comp.knobs || [])[0]}` : 'Standard deployment', 'Follow best practices for scale'],
    failureModes: (comp.commonFailureModes || []).slice(0, 2),
  }
  const notesObj = {
    purpose: comp.purpose || '',
    keyDecisions: Array.isArray(notes.keyDecisions) ? notes.keyDecisions.slice(0, 2) : [String(notes.keyDecisions || '')],
    failureModes: Array.isArray(notes.failureModes) ? notes.failureModes.slice(0, 2) : [String(notes.failureModes || '')],
  }
  const enrich = ENRICHMENT[id] || ENRICHMENT[COMPONENT_ALIAS[id]]
  const defaultNotes = {
    what: comp.purpose || notesObj.purpose,
    why: (Array.isArray(j.reasons) ? j.reasons.map((r) => r.text).join('; ') : '') || enrich?.fr || enrich?.nfr || 'Required for architecture',
    scalingModel: enrich?.scale || (Array.isArray(comp.knobs) && comp.knobs[0] ? `Configure ${comp.knobs[0]}` : 'Standard horizontal scaling'),
    failureRisk: (Array.isArray(comp.commonFailureModes) ? comp.commonFailureModes : []).slice(0, 2).join('; ') || notesObj.failureModes?.[0] || 'Instance failure, SPOF without HA',
  }
  return {
    id,
    type: id,
    label: comp.name || id,
    category: comp.category || 'compute',
    description: comp.purpose || '',
    data: { notes: notesObj, defaultNotes },
    details: {
      purpose: comp.purpose,
      defaults: knobs,
      notes: notesObj,
      defaultNotes,
      ...details,
    },
    justification: {
      reasons: j.reasons,
      tradeoffs: j.tradeoffs || '',
      failureModes: j.failureModes || '',
      metrics: typeof j.metrics === 'object' && j.metrics !== null ? j.metrics : {},
    },
  }
}

/** Required groups for Chat System reference architecture. */
const CHAT_REQUIRED_GROUPS = [
  { id: 'edge', label: 'Edge', ids: ['api-gateway', 'edge-rate-limiter'] },
  { id: 'auth', label: 'Auth', ids: ['auth-service'] },
  { id: 'realtime', label: 'Realtime', ids: ['realtime-gateway', 'presence-service'] },
  { id: 'core', label: 'Core', ids: ['conversation-service', 'message-service'] },
  { id: 'storage', label: 'Storage', ids: ['message-store', 'conversation-metadata-store'] },
  { id: 'pipeline', label: 'Pipeline', ids: ['event-log', 'worker', 'dlq'] },
  { id: 'notifications', label: 'Notifications', ids: ['notification-service'] },
  { id: 'media', label: 'Media', ids: ['object-storage', 'cdn', 'media-service'] },
  { id: 'observability', label: 'Observability', ids: ['metrics', 'logging', 'tracing'] },
]

function buildChatSystemDiagramSpec(signals, tags, text, funcReqs, nfReqs, constraints) {
  const t = (text || '').toLowerCase()
  const validIds = new Set(COMPONENTS.map((c) => c.id))
  const nodes = []
  const added = new Set()
  const trafficLoad = signals?.qps || 0
  const highTraffic = trafficLoad >= 50000

  const add = (id, justificationOverrides = null) => {
    if (!validIds.has(id) || added.has(id)) return
    const comp = getComponentById(id)
    if (!comp) return
    const j = justificationOverrides ?? buildJustification(id, funcReqs, nfReqs, constraints, comp, signals)
    if (!j || (Array.isArray(j.reasons) && j.reasons.length < MIN_REASONS)) return
    added.add(id)
    let node = buildNode(id, comp, j)
    if (highTraffic && ['message-store', 'api-gateway', 'edge-rate-limiter', 'worker', 'cache'].includes(id)) {
      const extraNotes = {}
      if (id === 'message-store') {
        extraNotes.shardingStrategy = 'Shard by conversationId; consider composite (conversationId, messageId) for very hot threads'
        extraNotes.partitionKeyGuidance = 'Use conversationId as partition key; sort by timestamp or messageId'
      }
      if (id === 'api-gateway' || id === 'edge-rate-limiter') {
        extraNotes.backpressureLoadShedding = 'Reject 429 when overloaded; circuit break on downstream failures; per-user queues with max depth'
      }
      if (id === 'worker') {
        extraNotes.backpressureLoadShedding = 'Limit consumer concurrency per partition; use separate consumer groups for different priorities'
      }
      if (id === 'cache' && !added.has('cache')) {
        extraNotes.cachingLayer = 'Cache conversation metadata and recent messages; TTL 60s–5min; invalidate on write'
      }
      node.details = { ...node.details, ...extraNotes }
    }
    nodes.push(node)
  }

  const baseReasons = (fr, nfr) => ({ reasons: [{ type: 'FR', text: fr }, { type: 'NFR', text: nfr }] })

  add('web-app', baseReasons('User entry point for chat UI', 'Required for any chat client'))
  add('load-balancer-l7', baseReasons('Distribute traffic to gateways', 'HA and load distribution'))
  CHAT_REQUIRED_GROUPS.forEach((g) => g.ids.forEach((id) => add(id)))
  if (highTraffic) add('cache')

  const completenessChecklist = CHAT_REQUIRED_GROUPS.map((g) => ({
    group: g.label,
    present: g.ids.every((id) => added.has(id)),
    nodes: g.ids.filter((id) => added.has(id)),
  }))

  const missingGroups = completenessChecklist.filter((c) => !c.present)
  missingGroups.forEach((c) => c.nodes.forEach((id) => add(id)))

  const edges = []
  const edge = (a, b) => { if (added.has(a) && added.has(b)) edges.push({ source: a, target: b }) }
  const chain = (ids) => { for (let i = 0; i < ids.length - 1; i++) edge(ids[i], ids[i + 1]) }
  chain(['web-app', 'api-gateway', 'edge-rate-limiter', 'load-balancer-l7'])
  edge('api-gateway', 'auth-service')
  edge('load-balancer-l7', 'message-service')
  edge('load-balancer-l7', 'conversation-service')
  edge('load-balancer-l7', 'realtime-gateway')
  edge('message-service', 'message-store')
  edge('message-service', 'conversation-metadata-store')
  edge('message-service', 'event-log')
  edge('event-log', 'worker')
  edge('worker', 'realtime-gateway')
  edge('worker', 'notification-service')
  edge('worker', 'dlq')
  edge('realtime-gateway', 'presence-service')
  edge('message-service', 'media-service')
  edge('media-service', 'object-storage')
  edge('media-service', 'cdn')
  if (added.has('cache')) {
    edge('message-service', 'cache')
    edge('conversation-service', 'cache')
  }
  ;['message-service', 'conversation-service', 'worker', 'realtime-gateway', 'notification-service'].forEach((svc) => edge(svc, 'metrics'))
  edge('message-service', 'logging')
  edge('message-service', 'tracing')

  const flows = [
    {
      id: 'send-message-write',
      name: 'Send Message write path',
      path: ['web-app', 'api-gateway', 'message-service', 'message-store'].filter((x) => added.has(x)),
    },
    {
      id: 'realtime-delivery',
      name: 'Realtime delivery path',
      path: ['message-service', 'event-log', 'worker', 'realtime-gateway'].filter((x) => added.has(x)),
    },
    {
      id: 'offline-push',
      name: 'Offline push path',
      path: ['message-service', 'event-log', 'worker', 'notification-service'].filter((x) => added.has(x)),
    },
  ]

  const positioned = assignLayeredPositions(nodes, true)
  return {
    nodes: positioned,
    edges: [...new Map(edges.map((e) => [`${e.source}->${e.target}`, e])).values()],
    flows,
    completenessChecklist,
    meta: { removedCount: 0 },
  }
}

function isNewsFeed(text) {
  const t = (text || '').toLowerCase()
  return /news\s*feed|newsfeed|feed|timeline|twitter|design\s+(a\s+)?feed|post\s+feed|social\s+feed/i.test(t)
}

function isNotificationSystem(text) {
  const t = (text || '').toLowerCase()
  return /notification\s*system|push\s*notification|notify|alert\s*system|design\s+(a\s+)?notification/i.test(t)
}

function buildNewsFeedDiagramSpec(signals, tags, text, funcReqs, nfReqs, constraints) {
  const validIds = new Set([...COMPONENTS.map((c) => c.id), 'write-api', 'read-api'])
  const nodes = []
  const added = new Set()
  const baseReasons = (fr, nfr) => ({ reasons: [{ type: 'FR', text: fr }, { type: 'NFR', text: nfr }] })

  const add = (id, j = null) => {
    if (!validIds.has(id) || added.has(id)) return
    const comp = getComponentById(id)
    if (!comp) return
    const justification = j ?? buildJustification(id, funcReqs, nfReqs, constraints, comp, signals)
    if (!justification || (Array.isArray(justification.reasons) && justification.reasons.length < MIN_REASONS)) return
    added.add(id)
    const labelOverride = id === 'write-api' ? 'Write API (Post)' : id === 'read-api' ? 'Read API (Feed)' : null
    let node = buildNode(id, comp, justification)
    if (labelOverride) node = { ...node, label: labelOverride }
    nodes.push(node)
  }

  add('web-app', baseReasons('User entry point', 'Required for any feed client'))
  add('dns')
  add('cdn')
  add('waf')
  add('edge-rate-limiter')
  add('api-gateway')
  add('auth-service')
  add('write-api', baseReasons('Create post, like, follow', 'Write path for mutations'))
  add('read-api', baseReasons('Get personalized feed, profile', 'Read path for queries'))
  add('event-log', baseReasons('Fanout post events', 'Async fanout to followers'))
  add('queue')
  add('worker', baseReasons('Fanout to timelines, index', 'Background fanout; retry + DLQ'))
  add('dlq')
  add('sql-db')
  add('sql-read-replica')
  add('kv-store', baseReasons('Timeline per user', 'Pre-computed feed store'))
  add('cache')
  add('search-index', baseReasons('Search posts', 'Full-text search'))
  add('metrics')
  add('logging')
  add('tracing')

  while (nodes.length < 10) {
    const extras = ['object-storage', 'scheduler', 'policy-authorization'].filter((x) => !added.has(x))
    if (extras.length === 0) break
    add(extras[0])
  }

  const edges = []
  const edge = (a, b) => { if (added.has(a) && added.has(b)) edges.push({ source: a, target: b }) }
  edge('web-app', 'api-gateway')
  edge('api-gateway', 'auth-service')
  edge('api-gateway', 'write-api')
  edge('api-gateway', 'read-api')
  edge('write-api', 'event-log')
  edge('write-api', 'queue')
  edge('write-api', 'sql-db')
  edge('event-log', 'worker')
  edge('queue', 'worker')
  edge('worker', 'dlq')
  edge('worker', 'kv-store')
  edge('worker', 'search-index')
  edge('read-api', 'cache')
  edge('read-api', 'sql-read-replica')
  edge('read-api', 'kv-store')
  edge('cache', 'sql-read-replica')
  edge('sql-db', 'sql-read-replica')
  ;['write-api', 'read-api', 'worker'].forEach((s) => edge(s, 'metrics'))
  edge('write-api', 'logging')
  edge('read-api', 'tracing')

  const positioned = assignLayeredPositions(nodes, true)
  return {
    nodes: positioned,
    edges: [...new Map(edges.map((e) => [`${e.source}->${e.target}`, e])).values()],
  }
}

function buildNotificationDiagramSpec(signals, tags, text, funcReqs, nfReqs, constraints) {
  const validIds = new Set([...COMPONENTS.map((c) => c.id), 'write-api', 'read-api'])
  const nodes = []
  const added = new Set()
  const baseReasons = (fr, nfr) => ({ reasons: [{ type: 'FR', text: fr }, { type: 'NFR', text: nfr }] })

  const add = (id, j = null) => {
    if (!validIds.has(id) || added.has(id)) return
    const comp = getComponentById(id)
    if (!comp) return
    const justification = j ?? buildJustification(id, funcReqs, nfReqs, constraints, comp, signals)
    if (!justification || (Array.isArray(justification.reasons) && justification.reasons.length < MIN_REASONS)) return
    added.add(id)
    const labelOverride = id === 'write-api' ? 'Event Ingest API' : id === 'read-api' ? 'Delivery API' : null
    let node = buildNode(id, comp, justification)
    if (labelOverride) node = { ...node, label: labelOverride }
    nodes.push(node)
  }

  add('web-app', baseReasons('User entry point', 'Required'))
  add('api-gateway')
  add('edge-rate-limiter')
  add('auth-service')
  add('write-api', baseReasons('Ingest events, subscribe', 'Event ingestion'))
  add('read-api', baseReasons('Fetch preferences, delivery status', 'Read path'))
  add('event-log')
  add('queue')
  add('worker', baseReasons('Fanout, batching, retry', 'Retry: exponential backoff, DLQ'))
  add('dlq')
  add('notification-service')
  add('sql-db')
  add('kv-store', baseReasons('User preferences, device tokens', 'Preference store'))
  add('cache')
  add('metrics')
  add('logging')
  add('tracing')

  while (nodes.length < 10) {
    const extras = ['scheduler', 'sql-read-replica', 'waf', 'cdn'].filter((x) => !added.has(x))
    if (extras.length === 0) break
    add(extras[0])
  }

  const edges = []
  const edge = (a, b) => { if (added.has(a) && added.has(b)) edges.push({ source: a, target: b }) }
  edge('web-app', 'api-gateway')
  edge('api-gateway', 'write-api')
  edge('api-gateway', 'read-api')
  edge('write-api', 'event-log')
  edge('write-api', 'queue')
  edge('write-api', 'sql-db')
  edge('event-log', 'worker')
  edge('queue', 'worker')
  edge('worker', 'dlq')
  edge('worker', 'notification-service')
  edge('worker', 'kv-store')
  edge('read-api', 'cache')
  edge('read-api', 'kv-store')
  edge('cache', 'sql-db')
  ;['write-api', 'read-api', 'worker', 'notification-service'].forEach((s) => edge(s, 'metrics'))
  edge('write-api', 'logging')

  const positioned = assignLayeredPositions(nodes, true)
  return {
    nodes: positioned,
    edges: [...new Map(edges.map((e) => [`${e.source}->${e.target}`, e])).values()],
  }
}

function isChatSystem(text) {
  const t = (text || '').toLowerCase()
  return /chat\s+system|design\s+chat|messaging\s+system|im\s+system|instant\s+messag/i.test(t)
}

/**
 * C) Component-driven synthesis: build diagram from signals and requirements.
 */
function buildDiagramSpec(signals, tags, text, funcReqs, nfReqs, constraints) {
  if (isChatSystem(text)) return buildChatSystemDiagramSpec(signals, tags, text, funcReqs, nfReqs, constraints)
  if (isNewsFeed(text)) return buildNewsFeedDiagramSpec(signals, tags, text, funcReqs, nfReqs, constraints)
  if (isNotificationSystem(text)) return buildNotificationDiagramSpec(signals, tags, text, funcReqs, nfReqs, constraints)
  const t = (text || '').toLowerCase()
  const validIds = new Set(COMPONENTS.map((c) => c.id))
  const nodes = []
  const added = new Set()

  const removedIds = []
  const add = (id, justificationOverrides = null) => {
    if (!validIds.has(id) || added.has(id)) return
    const comp = getComponentById(id)
    if (!comp) return
    const j = justificationOverrides ?? buildJustification(id, funcReqs, nfReqs, constraints, comp, signals)
    if (!j || (Array.isArray(j.reasons) && j.reasons.length < MIN_REASONS)) {
      removedIds.push(id)
      return
    }
    added.add(id)
    nodes.push(buildNode(id, comp, j))
  }

  // Edge Layer
  add('web-app', { reasons: [{ type: 'FR', text: 'User entry point for all actions' }, { type: 'NFR', text: 'Required for any user-facing system' }] })
  add('cdn')
  add('waf')
  add('edge-rate-limiter')
  add('api-gateway')
  add('load-balancer-l7')

  // Control / routing already in edge
  if (/auth|login|oauth|jwt|session/i.test(t)) add('auth-service')

  // Compute Layer
  add('app-service')

  // Async Layer
  if (signals.realTime || signals.fanoutReq || tags.has('async')) {
    add('queue')
    add('worker')
    add('event-log')
  }
  if (signals.fanoutReq || tags.has('async')) add('pubsub')

  // Auto-enrich: DLQ for every queue
  if (added.has('queue')) add('dlq')

  // Design expansion
  const expansion = getExpansionComponents(signals, tags)
  for (const id of expansion) add(id)

  if (signals.mediaReq || tags.has('media')) {
    add('object-storage')
    add('cdn')
  }
  if (signals.searchReq || tags.has('search')) add('search-index')
  if (/vector|embedding|semantic/i.test(t)) add('vector-index')

  // Storage Layer
  add('sql-db')
  if (signals.readHeavy || signals.qps >= 10000 || /replica|read.?scale|availability|99/i.test(t)) add('sql-read-replica')
  if (signals.qps >= 100000 || signals.writeHeavy || /shard|partition|scale.?write|horizontal|kv|session/i.test(t)) add('kv-store')
  if (/document|flexible|nosql|schema/i.test(t)) add('document-store')

  // E) Depth: traffic > 100K RPS
  if (signals.qps >= 100000) {
    add('cache')
    add('queue')
    add('worker')
    if (!added.has('kv-store')) add('kv-store')
  } else if (signals.readHeavy || signals.latencySensitive || tags.has('cache')) {
    add('cache')
  }
  if (/invalidation|fresh|cache.?bust/i.test(t)) add('cache-invalidation')

  if (/schedule|cron|periodic|batch|rollup/i.test(t)) add('scheduler')
  if (/rate.?limit|throttle|abuse|quota/i.test(t)) add('edge-rate-limiter')
  if (/waf|security|sql.?injection|xss|bot/i.test(t)) add('waf')

  // Cross-cutting: retries, circuit breakers, rate limiting, metrics
  if (signals.qps >= 10000 || /reliability|resilience|failure/i.test(t)) {
    add('circuit-breaker')
    add('retry-policy')
  }

  // Observability Layer
  add('metrics')
  add('logging')
  if (signals.latencySensitive && signals.qps >= 10000) add('tracing')

  // F) PRO-level: minimum 12 components, full observability, resilience
  const minComponents = 12
  if (!added.has('metrics')) add('metrics')
  if (!added.has('logging')) add('logging')
  if (!added.has('tracing') && signals.latencySensitive) add('tracing')
  if (nodes.length < minComponents) {
    const extra = ['dlq', 'cache', 'sql-read-replica', 'dns', 'policy-authorization', 'scheduler', 'time-series-db', 'bulkhead', 'cdn', 'circuit-breaker', 'retry-policy', 'cache-invalidation']
    for (const id of extra) {
      if (nodes.length >= minComponents) break
      add(id)
    }
  }

  // Build edges
  const edges = []
  const front = ['web-app']
  if (added.has('waf')) front.push('waf')
  if (added.has('edge-rate-limiter')) front.push('edge-rate-limiter')
  if (added.has('api-gateway')) front.push('api-gateway')
  front.push('load-balancer-l7', 'app-service')
  const present = front.filter((x) => added.has(x))
  for (let i = 0; i < present.length - 1; i++) edges.push({ source: present[i], target: present[i + 1] })

  const backends = ['cache', 'queue', 'event-log', 'pubsub', 'search-index', 'vector-index', 'sql-db', 'object-storage', 'document-store', 'kv-store', 'worker', 'metrics', 'logging', 'tracing', 'auth-service', 'circuit-breaker', 'retry-policy']
  for (const b of backends) {
    if (added.has('app-service') && added.has(b)) edges.push({ source: 'app-service', target: b })
  }
  if (added.has('sql-db') && added.has('sql-read-replica')) edges.push({ source: 'sql-db', target: 'sql-read-replica' })
  if (added.has('queue') && added.has('worker')) edges.push({ source: 'queue', target: 'worker' })
  if (added.has('event-log') && added.has('worker')) edges.push({ source: 'event-log', target: 'worker' })
  if (added.has('worker') && added.has('dlq')) edges.push({ source: 'worker', target: 'dlq' })
  if (added.has('app-service') && added.has('cdn')) edges.push({ source: 'app-service', target: 'cdn' })
  if (added.has('app-service') && added.has('object-storage')) edges.push({ source: 'app-service', target: 'object-storage' })

  const positioned = assignLayeredPositions(nodes, false)
  return { nodes: positioned, edges, removedCount: removedIds.length }
}

function heuristicCreate(text, options = {}) {
  const formatOnly = options.formatOnly === true
  const raw = (text || '').trim()
  if (!raw && !formatOnly) return validateQuestionPack({ id: `pack-${Date.now()}`, title: 'Untitled' })

  const titleMatch = raw.match(/Design(?:ing)?\s+([^\n]+)/i) || raw.match(/^#?\s*(.+)/m)
  const rawTitle = titleMatch ? titleMatch[1].trim() : 'System Design'
  const title = options.canonicalTitle
    ? normalizeTitle(options.canonicalTitle)
    : truncate(formatOnly ? rawTitle : normalizeTitle(rawTitle), MAX_TITLE)
  const id = options.id ?? titleToPackId(title)

  const intro = raw.split(/(?:Functional|Non[-\s]*Functional)\s*Requirements?/i)[0].trim()
  const problemLines = intro.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 15).slice(0, 4)
  const problemStatement = problemLines.join('\n').slice(0, 600)

  const funcBlock = raw.match(/Functional\s*Requirements?\s*[:\-]?\s*([\s\S]*?)(?=Non[-\s]*Functional|$)/i)?.[1] ?? raw
  const nfBlock = raw.match(/Non[-\s]*Functional\s*Requirements?\s*[:\-]?\s*([\s\S]*?)(?=Functional|$)/i)?.[1] ?? ''
  const funcLines = extractLines(funcBlock, (s) => FR_VERBS.test(s), 10)
  const nfLines = extractLines(nfBlock, (s) => NFR_KEYWORDS.test(s), 10)
  while (funcLines.length < 6) funcLines.push('User can perform core actions')
  while (nfLines.length < 6) nfLines.push('System should be scalable and available')

  const constraintsAssumptions = [
    'Assume standard cloud infrastructure',
    'Assume moderate initial scale',
    'Assume eventual consistency acceptable where appropriate',
    'Assume single region initially',
    'Assume existing auth system',
  ].slice(0, 8)

  const apiSketch = [
    { method: 'POST', path: '/api/create', purpose: 'Create resource' },
    { method: 'GET', path: '/api/:id', purpose: 'Fetch resource' },
    { method: 'GET', path: '/api/list', purpose: 'List with pagination' },
  ]
  const dataModel = [
    { entity: 'Resource', fields: ['id', 'data', 'createdAt'] },
    { entity: 'User', fields: ['id', 'metadata'] },
  ]

  const tags = extractTags(raw)
  const signals = parseRequirements(raw, funcLines, nfLines, constraintsAssumptions)
  const spec = buildDiagramSpec(signals, tags, raw, funcLines, nfLines, constraintsAssumptions)
  const diagramSpec = {
    nodes: spec.nodes,
    edges: spec.edges,
    meta: { removedCount: spec.meta?.removedCount ?? spec.removedCount ?? 0 },
    ...(spec.flows && { flows: spec.flows }),
    ...(spec.completenessChecklist && { completenessChecklist: spec.completenessChecklist }),
  }

  const scoringRubric = [
    'Clear separation of concerns',
    'Scalable components with numbers',
    'Failure mode analysis',
    'Explicit tradeoffs stated',
    'API and data model defined',
    'Consistency/availability clarified',
  ]
  const antiPatterns = [
    'Single point of failure',
    'No caching for read-heavy',
    'Synchronous when async needed',
    'Missing partition/sharding for scale',
    'No idempotency for retries',
    'Vague numbers (no QPS, p99)',
  ]
  const starterHints = ['Start with requirements scope', 'Estimate QPS and storage', 'Identify read vs write ratio']

  return validateQuestionPack({
    id,
    title,
    problemStatement,
    functionalRequirements: funcLines,
    nonFunctionalRequirements: nfLines,
    constraintsAssumptions,
    apiSketch,
    dataModel,
    diagramSpec,
    scoringRubric,
    antiPatterns,
    starterHints,
  })
}

function sanitizeLlamaDiagramSpec(parsed) {
  if (!parsed?.diagramSpec?.nodes) return parsed
  const validIds = new Set(COMPONENTS.map((c) => c.id))
  const nodes = parsed.diagramSpec.nodes
    .map((n) => {
      const raw = (n.id || n.type || '').toLowerCase().trim()
      const id = validIds.has(raw) ? raw : (SYNONYM_MAP.get(raw) || raw)
      if (!validIds.has(id)) return null
      const comp = getComponentById(id)
      const label = comp?.name || n.label || id
      const reasons = n.justification?.reasons || []
      if (reasons.length < MIN_REASONS) return null
      const metrics = (n.justification?.metrics && typeof n.justification.metrics === 'object') ? n.justification.metrics : {}
      const j = {
        reasons,
        tradeoffs: comp?.commonFailureModes?.join?.('; ') || n.justification?.tradeoffs || '',
        failureModes: comp?.commonFailureModes?.join?.('; ') || n.justification?.failureModes || '',
        metrics,
      }
      return {
        ...n,
        id,
        type: id,
        label,
        category: comp?.category || 'compute',
        description: comp?.purpose || '',
        details: { ...(n.details || {}), purpose: comp?.purpose || n.details?.purpose, defaults: comp?.knobs || n.details?.defaults || {} },
        justification: { ...j, ...(n.justification || {}) },
      }
    })
    .filter(Boolean)
  const keptIds = new Set(nodes.map((n) => n.id))
  const edges = (parsed.diagramSpec.edges || []).filter((e) => keptIds.has(e.source) && keptIds.has(e.target))
  parsed.diagramSpec = { ...parsed.diagramSpec, nodes, edges }
  return parsed
}

/**
 * Create QuestionPack from raw text.
 * @param {string} text - Raw extracted text (pdf/transcript)
 * @returns {Promise<object>} Valid QuestionPack
 */
export async function createFromText(text) {
  if (!text || typeof text !== 'string') return heuristicCreate('')

  const { isConfigured } = await import('../runtime/llamaRuntime.js').then((m) => ({ isConfigured: m.isConfigured })).catch(() => ({ isConfigured: () => false }))
  if (isConfigured && isConfigured()) {
    const validIds = COMPONENTS.map((c) => c.id).join(', ')
    const prompt = `Output ONLY valid JSON for a system design QuestionPack. Use ONLY these component ids: ${validIds}. Use generic names (from component name), NOT product names (no AWS/Azure/GCP names). Each node MUST have at least 2 justification reasons: id, label, category, description, justification:{reasons:[{type:"FR"|"NFR"|"SCALE"|"FAILURE_MITIGATION",text:"..."}], tradeoffs:"", failureModes:"", metrics:{expectedLoad:"", latencyImpact:"", scaleThreshold:""}}. Nodes with fewer than 2 reasons will be REMOVED. Min 8 components. Fields: id, title (<=80 chars), problemStatement, functionalRequirements, nonFunctionalRequirements, constraintsAssumptions, apiSketch, dataModel, diagramSpec:{nodes,edges}, scoringRubric, antiPatterns, starterHints.`
    let llamaOut = await generate(prompt, String(text).slice(0, 6000))
    if (llamaOut) {
      llamaOut = normalizeVendorTerms(llamaOut)
      try {
        const m = llamaOut.match(/\{[\s\S]*\}/)
        if (m) {
          const parsed = JSON.parse(m[0])
          const sanitized = sanitizeLlamaDiagramSpec(parsed)
          return validateQuestionPack(sanitized)
        }
      } catch (e) {
        console.warn('CreatorAgent: llama parse failed, using heuristic')
      }
    }
  }

  return heuristicCreate(text)
}

/**
 * Create QuestionPack from structured input (for wizard).
 * Uses stablePackId when provided to avoid duplicate Question Bank entries.
 */
export function createFromStructured(input, stablePackId = null) {
  const { title, problem, functional = [], nonFunctional = [], constraints = {} } = input
  const text = [
    title || 'System Design',
    problem,
    'Functional:', ...functional,
    'Non-Functional:', ...nonFunctional,
    'Constraints:', constraints.rps || constraints.traffic || '', constraints.storage || '', constraints.latency || '', constraints.availability || '',
  ].filter(Boolean).join('\n')
  const fallbackId = `pack-${Date.now()}-${(title || 'design').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 30)}`
  return heuristicCreate(text, { id: stablePackId || fallbackId, canonicalTitle: title })
}

/**
 * formatOnly: clean messy raw text into strict QuestionPack.
 */
export function formatPack(rawText) {
  if (!rawText || typeof rawText !== 'string') return heuristicCreate('', { formatOnly: true })
  const cleaned = String(rawText)
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .split('\n')
    .map((l) => truncate(l.trim(), MAX_ONELINER))
    .filter((l) => l.length > 3)
    .join('\n')
  return heuristicCreate(cleaned, { formatOnly: true })
}

export function appendToMemory(chunk) {
  appendCreatorMemory(chunk)
}
