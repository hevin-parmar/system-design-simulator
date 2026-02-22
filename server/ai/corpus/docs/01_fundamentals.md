# System Design Fundamentals

## What it is

High-level approach to building scalable, reliable systems. Combines requirements gathering, capacity estimation, component selection, and failure-mode analysis.

## When to use

- Any system that must scale beyond a single machine
- When latency, throughput, or availability matter
- Interview setting: demonstrate structured thinking

## When NOT to use

- Trivial CRUD with low traffic; over-engineering wastes time
- When requirements are unclear; scope first

## Tradeoffs

| Dimension | Option A | Option B |
|-----------|----------|----------|
| Consistency | Strong | Eventual |
| Latency | Low (cache) | Higher (DB) |
| Complexity | Simple | Distributed |
| Cost | Cheap storage | Fast storage |

## Failure modes

- Single point of failure; add redundancy
- Cascading failure; use circuit breakers, timeouts
- Resource exhaustion; rate limit, backpressure

## Metrics / numbers to mention

- QPS, latency p50/p99, error rate
- Availability: 99.9% = 8.76h downtime/year
- 1M DAU ≈ 10–50 QPS average; 3–5x peak

## Common interviewer follow-ups

- "What's the bottleneck?"
- "How do you scale that?"
- "What if this component fails?"
- "Walk me through the numbers."

## Strong sample phrasing

"Start with requirements and constraints, then estimate QPS and storage. Design for the happy path first, then add caching and replication for scale."
