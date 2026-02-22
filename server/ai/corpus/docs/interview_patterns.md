# Interview Patterns

## What it is

Common structure and topics in system design interviews. Interviewers expect clarity on requirements, high-level design, deep dives, tradeoffs, and scaling.

## When to use it

- Preparing for system design interviews
- Evaluating candidate responses
- Structuring design discussions

## Tradeoffs

- Breadth vs depth: cover more vs go deeper on fewer
- Whiteboard vs conversational: visual helps; talking shows reasoning
- Time box: 45 min typical; prioritize critical path

## Failure scenarios

- Vague requirements: design wrong system. Ask clarifying questions.
- Jump to solution: miss key constraints. Requirements first.
- No numbers: "it scales" unconvincing. Capacity estimation.
- Ignore failure: "assume it doesn't fail" weak. Discuss failure modes.

## Scaling considerations

- Start simple: single box, then add components
- Explain why each component: load balancer for multiple app servers, etc.
- End with tradeoffs: what you sacrificed and why

## Metrics to monitor

- Time spent per phase
- Depth of follow-up answers
- Coverage of: requirements, HLD, APIs, data model, scaling, failure

## Real-world examples

- Clarify: "1M DAU or 1M QPS?" "Read-heavy or write-heavy?"
- High-level: "Client → LB → App servers → DB. Add cache for reads."
- Deep dive: "For cache, what key? TTL? Invalidation?"
- Tradeoff: "Strong consistency here; eventual for analytics."
- Interview phases: requirements → HLD → APIs/data → scaling → failure → wrap-up
