# Caching

## What it is

Store frequently accessed data in fast storage (memory, SSD) to reduce load on primary store and lower latency.

## When to use

- Read-heavy workload; same data requested repeatedly
- Primary store slow or expensive for high QPS
- Can tolerate some staleness (TTL)
- Need sub-ms read latency for hot data

## When NOT to use

- Write-heavy; cache invalidates constantly
- Data changes often; invalidation complexity
- Strong consistency required; cache adds staleness

## Tradeoffs

| Pattern | Consistency | Write latency | Complexity |
|---------|-------------|---------------|------------|
| Cache-aside | Stale possible | Low | Medium |
| Write-through | Strong | Higher | Low |
| Write-behind | Eventual | Lowest | High; data loss risk |

## Failure modes

- Cache stampede: key expires, many requests hit DB. Use single-flier or probabilistic early expiry.
- Stale reads: TTL too long or invalidation bug
- Cache host fail: in-memory data lost; use replication
- Thundering herd: one key, many misses

## Metrics / numbers to mention

- Hit rate target: 80–95%
- TTL: seconds to hours depending on freshness need
- P99 latency: cache <1ms vs DB 10–50ms
- Eviction: LRU common; memory bound

## Common interviewer follow-ups

- "Write-through or write-back? Why?"
- "Invalidation strategy?"
- "What if cache goes down?"
- "How to avoid cache stampede?"

## Strong sample phrasing

"Cache-aside with TTL of 5 minutes for read-heavy feeds. On write, invalidate key. Single-flier on miss to prevent stampede. If Redis fails, degrade to DB; add replicas for HA."
