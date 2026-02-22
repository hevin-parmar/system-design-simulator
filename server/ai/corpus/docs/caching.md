# Caching

## What it is

Store frequently accessed data in fast storage (memory, SSD) to reduce load on primary store and lower latency.

## When to use

- Read-heavy workload
- Primary store slow or expensive
- Can tolerate staleness (TTL)
- Need sub-ms read latency

## Tradeoffs

- Cache-aside: app control, stale possible
- Write-through: strong consistency, higher write latency
- Write-behind: lowest write latency, data loss risk

## Failure modes

- Cache stampede: key expires, many requests hit DB
- Stale reads: TTL too long, invalidation bug
- Cache host fail: in-memory data lost

## Numbers to mention

- Hit rate: 80–95%
- TTL: seconds to hours
- P99: cache <1ms vs DB 10–50ms
- Eviction: LRU, memory bound

## Interview prompts

- "Write-through or write-back? Why?"
- "Invalidation strategy?"
- "What if cache goes down?"
- "How to avoid cache stampede?"

## Strong answer outline

1. Pattern: cache-aside, write-through, write-behind
2. TTL and invalidation
3. Stampede prevention: single-flier, probabilistic expiry
4. Failure: degrade to DB, replication for HA
