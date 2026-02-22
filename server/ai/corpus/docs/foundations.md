# Foundations

## What it is

System design is the practice of defining components, data flow, and tradeoffs to meet functional and non-functional requirements at scale.

## When to use

- Designing new systems or major features
- Scaling existing systems
- Preparing for system design interviews

## Tradeoffs

- Simplicity vs performance
- Consistency vs availability (CAP)
- Cost vs latency vs throughput

## Failure modes

- Single point of failure
- Cascading failures
- Resource exhaustion (CPU, memory, connections)

## Numbers to mention

- QPS, p99 latency, availability (e.g. 99.9%)
- Storage growth, retention
- RTO/RPO for disaster recovery

## Interview prompts

- "Walk me through the high-level architecture"
- "What are the bottlenecks?"
- "How would you scale this 10x?"

## Strong answer outline

1. Clarify requirements (functional + non-functional)
2. Estimate capacity (QPS, storage)
3. High-level components and data flow
4. Identify bottlenecks and mitigation
5. Tradeoffs and failure modes
