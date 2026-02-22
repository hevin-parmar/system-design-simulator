/**
 * Component Store registry.
 * Categorized palette with defaults for each component type.
 */

export const CATEGORIES = [
  { id: 'Compute', label: 'Compute', order: 0 },
  { id: 'Storage', label: 'Storage', order: 1 },
  { id: 'Caching', label: 'Caching', order: 2 },
  { id: 'Messaging', label: 'Messaging', order: 3 },
  { id: 'Networking', label: 'Networking', order: 4 },
  { id: 'Observability', label: 'Observability', order: 5 },
  { id: 'Security', label: 'Security', order: 6 },
]

export const COMPONENT_REGISTRY = [
  { id: 'client', label: 'Client', category: 'Compute', tags: ['client', 'user', 'browser'], defaults: {}, purpose: 'User device or browser making requests', whenToUse: 'Entry point for all user traffic', tradeoffs: ['Thin vs thick client tradeoffs'], failureModes: ['Client-side failures isolated'], interviewHooks: ['How handle offline?'] },
  { id: 'load-balancer', label: 'Load Balancer', category: 'Networking', tags: ['lb', 'traffic', 'ha'], defaults: { replicas: 2 }, purpose: 'Distribute traffic across servers', whenToUse: 'High availability, horizontal scaling', tradeoffs: ['L4 vs L7; sticky sessions'], failureModes: ['Single LB = SPOF; use health checks'], interviewHooks: ['How do health checks work?'] },
  { id: 'app-server', label: 'App Server', category: 'Compute', tags: ['api', 'compute', 'logic'], defaults: { replicas: 4 }, purpose: 'Handles business logic and API', whenToUse: 'Core application processing', tradeoffs: ['Stateless for horizontal scale'], failureModes: ['Crash; use multiple replicas'], interviewHooks: ['How scale under load?'] },
  { id: 'worker', label: 'Worker', category: 'Compute', tags: ['async', 'processor'], defaults: { replicas: 2 }, purpose: 'Background job processing', whenToUse: 'Async tasks, cron jobs', tradeoffs: ['At-least-once vs exactly-once'], failureModes: ['Duplicate processing; idempotency'], interviewHooks: ['How ensure exactly-once?'] },
  { id: 'database', label: 'Database', category: 'Storage', tags: ['db', 'persistence', 'sql'], defaults: { replicas: 2 }, purpose: 'Persistent data storage', whenToUse: 'Transactional, structured data', tradeoffs: ['SQL vs NoSQL; consistency vs availability'], failureModes: ['Single node; replication lag'], interviewHooks: ['Sharding strategy?'] },
  { id: 'object-storage', label: 'Object Storage', category: 'Storage', tags: ['blob', 's3', 'files'], defaults: {}, purpose: 'Blob and file storage', whenToUse: 'Images, videos, large files', tradeoffs: ['Eventual consistency; CDN in front'], failureModes: ['Slow uploads; multipart'], interviewHooks: ['How handle large uploads?'] },
  { id: 'search-index', label: 'Search Index', category: 'Storage', tags: ['search', 'elastic', 'full-text'], defaults: { shards: 3 }, purpose: 'Full-text search', whenToUse: 'Search, autocomplete, discovery', tradeoffs: ['Index lag vs consistency'], failureModes: ['Hot shards; split-brain'], interviewHooks: ['How keep index in sync with DB?'] },
  { id: 'cache', label: 'Cache', category: 'Caching', tags: ['redis', 'memcache', 'latency'], defaults: { ttl: 300, eviction: 'LRU', replicas: 2 }, purpose: 'Frequently accessed data', whenToUse: 'Read-heavy, hot data, reduce DB load', tradeoffs: ['TTL vs invalidation; consistency'], failureModes: ['Cache stampede; thundering herd'], interviewHooks: ['Cache invalidation strategy?'] },
  { id: 'message-queue', label: 'Message Queue', category: 'Messaging', tags: ['kafka', 'sqs', 'async'], defaults: { partitions: 10, retention: '7d' }, purpose: 'Async messaging, buffering', whenToUse: 'Decoupling, async processing, spikes', tradeoffs: ['Ordering vs partitioning; retention'], failureModes: ['Poison pill; DLQ'], interviewHooks: ['Message ordering guarantees?'] },
  { id: 'cdn', label: 'CDN', category: 'Networking', tags: ['static', 'edge', 'media'], defaults: {}, purpose: 'Static assets at edge', whenToUse: 'Images, JS, CSS, global latency', tradeoffs: ['Cache control; invalidate on deploy'], failureModes: ['Origin down; stale content'], interviewHooks: ['Invalidation strategy?'] },
  { id: 'api-gateway', label: 'API Gateway', category: 'Security', tags: ['auth', 'gateway', 'rate-limit'], defaults: {}, purpose: 'Auth, rate limiting, routing', whenToUse: 'Centralized auth, rate limiting', tradeoffs: ['Single gateway vs per-service'], failureModes: ['Bottleneck; scale horizontally'], interviewHooks: ['Rate limit per user or IP?'] },
  { id: 'auth-service', label: 'Auth Service', category: 'Security', tags: ['auth', 'oauth', 'jwt'], defaults: {}, purpose: 'Authentication and authorization', whenToUse: 'User identity, tokens', tradeoffs: ['JWT vs session; stateless'], failureModes: ['Token revocation; short TTL'], interviewHooks: ['How handle token refresh?'] },
  { id: 'metrics', label: 'Metrics Store', category: 'Observability', tags: ['prometheus', 'metrics'], defaults: { retention: '15d' }, purpose: 'Time-series metrics', whenToUse: 'Monitoring, alerting, SLOs', tradeoffs: ['Cardinality vs retention'], failureModes: ['Metric explosion; sampling'], interviewHooks: ['What metrics to track?'] },
  { id: 'log-aggregator', label: 'Log Aggregator', category: 'Observability', tags: ['logs', 'elk'], defaults: {}, purpose: 'Centralized logging', whenToUse: 'Debugging, audit, analysis', tradeoffs: ['Volume vs cost'], failureModes: ['Backpressure; drop logs'], interviewHooks: ['Log retention policy?'] },
  { id: 'rate-limiter', label: 'Rate Limiter', category: 'Security', tags: ['throttle', 'limit'], defaults: { rps: 100 }, purpose: 'Throttle requests per user/key', whenToUse: 'Prevent abuse, fair usage', tradeoffs: ['Token bucket vs sliding window'], failureModes: ['Distributed counting; Redis'], interviewHooks: ['Fixed window vs sliding?'] },
  { id: 'shard', label: 'Shard', category: 'Storage', tags: ['sharding', 'partition'], defaults: { partitionKey: 'user_id' }, purpose: 'Horizontal data partition', whenToUse: 'Scale writes, data too large for one node', tradeoffs: ['Key design; hotspot avoidance'], failureModes: ['Hot shard; rebalancing'], interviewHooks: ['Shard key selection?'] },
  { id: 'replica', label: 'Read Replica', category: 'Storage', tags: ['replica', 'read'], defaults: { lag: '100ms' }, purpose: 'Read scaling, failover', whenToUse: 'Read-heavy, availability', tradeoffs: ['Replication lag vs consistency'], failureModes: ['Split-brain; quorum'], interviewHooks: ['Read-after-write consistency?'] },
]

export function getComponentsByCategory() {
  const byCat = {}
  for (const c of CATEGORIES) byCat[c.id] = []
  for (const comp of COMPONENT_REGISTRY) {
    const cat = comp.category || 'Compute'
    if (!byCat[cat]) byCat[cat] = []
    byCat[cat].push(comp)
  }
  return byCat
}

export function searchComponents(query) {
  const q = (query || '').toLowerCase().trim()
  if (!q) return COMPONENT_REGISTRY
  return COMPONENT_REGISTRY.filter((c) =>
    c.label.toLowerCase().includes(q) ||
    (c.tags || []).some((t) => t.toLowerCase().includes(q)) ||
    (c.purpose || '').toLowerCase().includes(q)
  )
}
