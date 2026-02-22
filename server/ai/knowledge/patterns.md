# System Design Patterns

Vendor-neutral patterns for system design. Each section: **When** / **How** / **Tradeoffs** / **Failure modes** / **Metrics**.

---

## Cache-Aside (Lazy Loading)

**When:** Read-heavy workloads where DB is source of truth; cache is optional optimization.

**How:** App checks cache first; on miss, reads from DB and populates cache. Writes go to DB; app invalidates or updates cache.

**Tradeoffs:** Simplicity vs cache stampede on cold start. TTL-based invalidation vs write-through consistency. Cache miss adds latency; hit avoids DB.

**Failure modes:** Thundering herd when many requests miss. Stale data if TTL too long or invalidation missed.

**Metrics:** Cache hit rate, p99 read latency, DB load reduction.

---

## Read-Through

**When:** Consistent read path; cache sits in front of DB as abstraction.

**How:** Cache layer loads from DB on miss; app only talks to cache. Cache owns the load logic.

**Tradeoffs:** Simpler app logic vs less control over load behavior. Cache-aside gives app more control.

**Failure modes:** Cache layer becomes bottleneck. Stale reads if DB updated outside cache.

**Metrics:** Hit rate, loader latency, cache layer availability.

---

## Write-Through

**When:** Strong read-after-write consistency; cache and DB must agree.

**How:** Writes go to cache and DB together; cache write succeeds only when DB write succeeds (or vice versa).

**Tradeoffs:** Higher write latency (write to both). Simplicity of consistency vs write amplification.

**Failure modes:** Cache write succeeds, DB fails → inconsistency. Both must be transactional or eventually consistent.

**Metrics:** Write latency, consistency violations.

---

## Write-Back (Write-Behind)

**When:** Write throughput matters more than immediate durability; batch DB writes.

**How:** Writes go to cache first; async flush to DB. Risk: data loss if cache fails before flush.

**Tradeoffs:** Low write latency vs durability. Batch efficiency vs crash recovery.

**Failure modes:** Cache failure loses unflushed data. Ordering issues on replay.

**Metrics:** Flush lag, durability gap, write throughput.

---

## Invalidation Strategies

**When:** Keeping caches fresh after writes; TTL alone insufficient.

**How:** Event-based invalidation (publish invalidation on write). TTL fallback. Version/tag-based invalidation.

**Tradeoffs:** TTL-only vs event-driven. Eventual consistency vs complexity.

**Failure modes:** Missed invalidations. Out-of-order invalidation events.

**Metrics:** Staleness rate, invalidation latency, miss rate.

---

## Queue + Workers

**When:** Async processing; decouple producers from consumers; smooth spikes.

**How:** Producers push to queue; workers poll or subscribe; process and ack. Use DLQ for failures.

**Tradeoffs:** At-least-once vs exactly-once. Throughput vs latency. Visibility timeout vs duplicate processing.

**Failure modes:** Backlog growth. Poison messages blocking queue. Duplicate delivery.

**Metrics:** Consumer lag, DLQ depth, processing throughput, retry count.

---

## Idempotency

**When:** Retries, webhooks, at-least-once delivery; avoid duplicate side effects.

**How:** Idempotency key per logical operation; store (key → result) with TTL; return cached result on replay.

**Tradeoffs:** Storage for keys vs duplicate processing. Key scope: per request vs per operation.

**Failure modes:** Key collision (weak key design). TTL too short; replay after expiry.

**Metrics:** Duplicate rate, idempotency store size, replay latency.

---

## Pub/Sub Fanout

**When:** One event, many subscribers; decouple publishers from consumers.

**How:** Publish to topic; each subscription gets copy. Push or pull delivery.

**Tradeoffs:** Fanout amplification vs decoupling. At-least-once vs exactly-once per subscriber.

**Failure modes:** Slow consumer lag. Fanout cost explosion.

**Metrics:** Publish latency, consumer lag per subscription, fanout count.

---

## Event Log Streaming

**When:** High-throughput event streaming; replay; multiple consumers at different offsets.

**How:** Append-only log with partitions; consumers track offset; retention and compaction policies.

**Tradeoffs:** Partition key design for ordering vs parallelism. Retention vs cost.

**Failure modes:** Hot partition. Consumer lag. Rebalancing storms.

**Metrics:** Lag per partition, throughput, retention usage.

---

## Sharding

**When:** Data too large for single node; scale writes.

**How:** Partition by shard key; route reads/writes to shard. Consistent hashing or range partitioning.

**Tradeoffs:** Shard key design: avoid hotspots. Cross-shard queries expensive.

**Failure modes:** Hot shard. Uneven load. Rebalancing during traffic.

**Metrics:** Shard balance, cross-shard query latency, rebalance duration.

---

## Replication + Consistency

**When:** Read scaling; high availability; durability.

**How:** Primary-replica; sync or async replication. Read from replica with lag awareness.

**Tradeoffs:** Strong consistency vs availability. Replication lag vs read scaling.

**Failure modes:** Split-brain. Stale reads. Failover complexity.

**Metrics:** Replication lag, failover time, read replica load.

---

## Rate Limiting

**When:** Prevent abuse; fair usage; protect downstream.

**How:** Token bucket, sliding window, or fixed window. Limit per user/IP/API key. Distributed state in shared store.

**Tradeoffs:** Token bucket vs fixed window. Per-user vs per-IP. Accuracy vs cost.

**Failure modes:** Hot keys on limiter storage. Incorrect keying causing unfair limits.

**Metrics:** Reject rate, burst handling, limiter latency.

---

## Timeouts + Retries + Circuit Breakers

**When:** Resilient calls to dependencies; avoid cascading failures.

**How:** Timeout per call. Retry with backoff + jitter for transient failures. Circuit breaker opens after threshold; half-open to probe recovery.

**Tradeoffs:** Timeout too short vs too long. Retry amplification vs success rate. Circuit threshold tuning.

**Failure modes:** Retry storms. Circuit flapping. No fallback when circuit open.

**Metrics:** Timeout rate, retry count, circuit open rate, fallback usage.

---

## Bulkheads

**When:** Isolate failures; prevent one dependency from exhausting shared resources.

**How:** Separate thread pools, connection pools, or queues per dependency or route.

**Tradeoffs:** Resource efficiency vs isolation. Pool sizing.

**Failure modes:** Misallocation starves important traffic. Pool exhaustion.

**Metrics:** Pool utilization, rejection rate per pool.

---

## CQRS (Command Query Responsibility Segregation)

**When:** Read and write models differ; scale reads independently.

**How:** Separate write model (command) and read model (query). Sync via events; read model eventually consistent.

**Tradeoffs:** Complexity vs flexibility. Eventual consistency for reads.

**Failure modes:** Read model lag. Stale reads. Dual-write bugs; sync complexity.

**Metrics:** Read model lag, write throughput, read throughput.

---

## Fanout-on-Read vs Fanout-on-Write

**When:** Multiple consumers need same data; choose when to fan out.

**How:** Fanout-on-write: precompute at write time; read is cheap. Fanout-on-read: compute on read; writes simple.

**Tradeoffs:** Write amplification vs read latency. Storage vs compute.

**Failure modes:** Fanout-on-write: one consumer slow blocks write. Fanout-on-read: N+1 or expensive read.

**Metrics:** Write latency, read latency, storage cost.

---

## Observability

**When:** Debugging, alerting, SLOs; understand system behavior.

**How:** Metrics (SLIs, dashboards, alerts). Logging (structured, sampled, with correlation IDs). Tracing (distributed spans).

**Tradeoffs:** Cardinality vs cost. Sampling vs tail latency visibility.

**Failure modes:** Missing correlation. Alert fatigue. PII in logs.

**Metrics:** Coverage, cardinality, cost, mean time to detect.

---

## Multi-Region

**When:** DR, global latency, high availability.

**How:** Active-passive (failover) or active-active (multi-master). Replication sync or async. Conflict resolution for active-active.

**Tradeoffs:** Failover time vs cost. Consistency vs availability. Conflict resolution complexity.

**Failure modes:** Split-brain on partition. Failover cascade. Conflict storms.

**Metrics:** RTO, RPO, replication lag, conflict rate, cross-region latency.
