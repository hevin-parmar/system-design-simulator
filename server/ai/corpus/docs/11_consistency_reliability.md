# Consistency & Reliability

## What it is

**Consistency:** When reads see latest writes. **Reliability:** System available and correct under failures.

## When to use

- Design tradeoffs: strong vs eventual
- Replication, quorum, CAP
- Failure detection and recovery

## When NOT to use

- Single-node design; consistency trivial
- When interviewer wants component focus; stay on topic

## Tradeoffs

| Strong | Eventual |
|--------|----------|
| Read sees latest write | Stale reads possible |
| Higher latency, lower availability | Lower latency, higher availability |
| Critical for money, auth | OK for feeds, counters |

## Failure modes

- Split-brain: two primaries; use quorum
- Cascading failure: one component down takes others; circuit breaker
- Data loss: async replication; acknowledge sync durability

## Metrics / numbers to mention

- Quorum: W + R > N for read-your-writes
- Availability: 99.9% = 8.76h/year downtime
- RTO/RPO: recovery time/point objectives
- CAP: partition forces choice

## Common interviewer follow-ups

- "Strong or eventual? Where?"
- "Quorum settings?"
- "How detect split-brain?"
- "Read-your-writes—how?"

## Strong sample phrasing

"Strong consistency for account balance; eventual for activity feed. Quorum writes (W=2) for durability. Read-your-writes: route user's reads to primary or wait for replica sync."
