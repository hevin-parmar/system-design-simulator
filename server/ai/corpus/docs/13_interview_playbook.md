# Interview Playbook

## What it is

Structured approach to system design interviews: requirements, high-level design, deep dives, tradeoffs, failure modes.

## When to use

- Every system design interview
- When stuck; fall back to structure

## When NOT to use

- Coding round; different format
- When interviewer drives format; follow their lead

## Tradeoffs

| Structured | Ad-hoc |
|------------|--------|
| Covers bases | May miss areas |
| Slower start | Faster dive |
| Demonstrates method | Risk appearing scattered |

## Failure modes

- Jumping to solution; always scope first
- Ignoring numbers; estimate QPS, storage
- No tradeoffs; every choice has pros/cons
- Forgetting failure modes; "what if X fails?"

## Metrics / numbers to mention

- State assumptions: DAU, read/write ratio
- Back-of-envelope: QPS, storage, bandwidth
- SLOs: latency, availability
- Capacity per component

## Common interviewer follow-ups

- "Go deeper on X"
- "What's the bottleneck?"
- "How would you scale that?"
- "Tradeoffs?"

## Strong sample phrasing

"Clarify requirements and constraints. Estimate capacity. Draw high-level diagram. Walk through read and write path. Identify bottlenecks. Add caching, replication, async where needed. Discuss failure modes and mitigations."
