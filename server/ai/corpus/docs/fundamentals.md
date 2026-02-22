# System Design Fundamentals

## Load Balancer

**Routing strategies**
- **Round robin:** Rotate through backends. Simple, no session awareness.
- **Least connections:** Send to backend with fewest active connections. Better for uneven request duration.
- **IP hash:** Same client IP → same backend. Enables sticky routing without app support.

**Health checks:** Periodic probes (HTTP/TCP) to detect dead or overloaded backends. Remove from pool on failure; re-add when healthy. Typical interval 5–30s.

**L4 vs L7:** L4 operates on IP/port; L7 sees HTTP, supports path-based routing, header inspection, and TLS termination.

---

## Cache

**Patterns**
- **Read-through:** App reads from cache; cache loads from DB on miss.
- **Write-through:** Write goes to cache and DB synchronously. Strong consistency, higher latency.
- **Write-back (write-behind):** Write to cache; async flush to DB. Low latency, risk of data loss on crash.

**TTL:** Expiry time for entries. Balances freshness vs hit rate. Short TTL = fresher, more DB load.

**Invalidation:** On write, invalidate or update cached copies. Hard cache invalidation is tricky in distributed setups—often use TTL + versioned keys or event-driven invalidation.

---

## Sharding

**Strategies**
- **Hash-based:** `partition_key = hash(user_id) % num_shards`. Even distribution; range queries difficult.
- **Range-based:** Partition by key range (e.g. A–M, N–Z). Good for range scans; risk of hot shards at boundaries.

**Hot partitions:** One shard gets disproportionate load. Mitigate with secondary partition key, or split hot shards.

---

## Message Queues

**Delivery semantics**
- **At-least-once:** Consumer acks after processing. Retries on failure; duplicates possible.
- **Exactly-once:** Requires idempotent consumers + transactional outbox or deduplication.

**Retries:** Exponential backoff. Limit retries to avoid infinite loops.

**DLQ (Dead Letter Queue):** Messages that exceed retries go to DLQ for inspection or replay.

**Backpressure:** When consumers lag, producers slow down or reject. Prevents queue unbounded growth.

---

## Databases

**Primary / Replica**
- Primary handles writes; replicas replicate via WAL or binlog.
- Replicas serve reads; reduce load on primary.
- **Replication lag:** Writes on primary not yet visible on replica. Affects read-after-write consistency.

---

## Consistency & Availability

**Eventual consistency:** Replicas converge over time. Acceptable when immediate consistency not required (e.g. counters, analytics).

**Quorum:** For N replicas, write to W and read from R. If W + R > N, read sees latest write. Tradeoffs: higher W/R = stronger consistency, lower availability.

**CAP:** Under partition, choose consistency or availability. In practice, tune per operation.

---

## SLO / SLI / Error Budgets

**SLI:** Measured metric (e.g. latency p99, error rate).
**SLO:** Target for SLI (e.g. p99 < 200ms, 99.9% success).
**Error budget:** Allowed failure before SLO breached. Drives release and incident response decisions.

---

## Observability

**Logs:** Event records. Structured (JSON) for aggregation.
**Metrics:** Aggregated counters/gauges (QPS, latency percentiles, error rate).
**Traces:** Request flow across services. Correlate with trace IDs.

---

## Cost Basics

**Hot vs cold storage:** Hot = low-latency, higher cost (SSD, in-memory). Cold = archival, cheaper (object storage, infrequent access). Tier by access pattern.
