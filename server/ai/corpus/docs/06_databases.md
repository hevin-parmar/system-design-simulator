# Databases

## What it is

Persistent storage for structured (relational) or semi-structured (NoSQL) data. Supports queries, transactions, replication.

## When to use

- Need durable storage, ACID where required
- Complex queries, joins (SQL) or flexible schema (NoSQL)
- Replication for read scaling and HA

## When NOT to use

- Ephemeral data; use cache
- High-throughput append-only log; consider message queue
- Search over free text; use search index

## Tradeoffs

| SQL | NoSQL |
|-----|-------|
| ACID, joins | Flexible schema, scale-out |
| Vertical scale limit | Eventually consistent |
| Strong consistency | Tune per use case |

## Failure modes

- Primary failure: promote replica; downtime or automated failover
- Replication lag: read from replica may miss recent writes
- Connection exhaustion: pool limits, timeouts
- Hot rows: single key high QPS; shard or cache

## Metrics / numbers to mention

- Replication lag: ms to seconds
- Connection pool: 10–100 per app instance
- Read replica count: scale reads
- WAL/binlog for replication

## Common interviewer follow-ups

- "Single node or replicated?"
- "Read-your-writes consistency?"
- "Partition key?"
- "How handle primary failover?"

## Strong sample phrasing

"Primary-replica setup. Writes go to primary; reads from replicas. Accept replication lag for non-critical reads; read-from-primary for user's own writes. Connection pooling, 50 connections per app instance."
