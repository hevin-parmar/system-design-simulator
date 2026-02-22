# Requirements Gathering

## What it is

Clarifying functional and non-functional requirements before designing. Functional = what the system does; non-functional = how well (latency, availability, consistency).

## When to use

- Start of any system design; prevents scope creep
- When interviewer gives vague problem; ask clarifying questions

## When NOT to use

- When problem is already well-defined; don't over-clarify
- Mid-design deep dive; stay high-level at start

## Tradeoffs

| Clarify more | Clarify less |
|--------------|--------------|
| Less rework | Faster start |
| May over-engineer | Risk missing critical need |

## Failure modes

- Assuming requirements; always state assumptions
- Ignoring non-functional; latency/availability often matter most
- Scope creep; "out of scope" is a valid answer

## Metrics / numbers to mention

- DAU, reads vs writes ratio
- Latency SLO (e.g. p99 < 200ms)
- Availability target (99.9%, 99.99%)
- Data retention (30 days, 7 years)

## Common interviewer follow-ups

- "What's the read/write ratio?"
- "How many users? Active or total?"
- "What's acceptable latency?"
- "Any compliance requirements?"

## Strong sample phrasing

"I'll assume 10M DAU, 10:1 read/write, p99 latency under 200ms, and 99.9% availability. Correct me if any of these differ."
