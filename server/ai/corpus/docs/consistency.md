# Consistency

## What it is

Guarantees about when writes become visible to reads. Strong vs eventual consistency; CAP tradeoff.

## When to use

- Strong: financial transactions, inventory
- Eventual: social feeds, analytics, cache

## Tradeoffs

- Strong consistency: higher latency, lower availability
- Eventual: lower latency, possible stale reads
- CAP: pick 2 of Consistency, Availability, Partition tolerance

## Failure modes

- Stale reads from replicas
- Split-brain in multi-leader
- Write conflicts in distributed systems

## Numbers to mention

- Replication lag: ms (e.g. <100ms)
- Quorum: W + R > N for read-your-writes
- TTL for eventual consistency (cache)

## Interview prompts

- "What consistency do you need?"
- "When do you get stale reads?"
- "How do you handle replication lag?"

## Strong answer outline

1. State required consistency (strong vs eventual)
2. Replication model: leader-based, multi-leader
3. Read path: from leader vs replica
4. Write path: synchronous vs async replication
5. Tradeoff and why it's acceptable
