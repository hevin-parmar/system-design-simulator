# Databases

## What it is

Persistent storage with ACID or BASE guarantees. SQL vs NoSQL; replication and failover.

## When to use

- Persistent data
- Transactions
- Query patterns (relational vs key-value vs document)

## Tradeoffs

- SQL: strong consistency, schema; scaling limits
- NoSQL: flexible schema, scale-out; eventual consistency
- Read replicas: scale reads; replication lag

## Failure modes

- Primary failure: failover time
- Replication lag: stale reads
- Connection exhaustion: connection pooling
- Disk full, IOPS limit

## Numbers to mention

- Replication lag (ms)
- Failover time (RTO)
- Connection pool size
- Read/write ratio

## Interview prompts

- "SQL or NoSQL? Why?"
- "Replication lag?"
- "Failover strategy?"
- "Connection pooling?"

## Strong answer outline

1. Data model and access pattern
2. Replication: primary-replica, multi-leader
3. Consistency: read from leader vs replica
4. Failover: automated, RTO
5. Connection pooling, limits
