# Observability

## What it is

Logging, metrics, tracing to understand system behavior, debug issues, and meet SLOs.

## When to use

- Production systems
- Debugging incidents
- SLO/SLI tracking

## Tradeoffs

- Verbosity vs storage cost
- Sampling vs completeness
- Cardinality vs query performance

## Failure modes

- Log explosion (no sampling)
- Missing correlation IDs
- No alerting on key metrics
- High cardinality (user IDs in tags)

## Numbers to mention

- Retention: logs 7–30 days, metrics 90 days
- Sampling: 1% or 10% for traces
- SLO: 99.9% availability, p99 <200ms
- Alert thresholds

## Interview prompts

- "What metrics do you alert on?"
- "How do you debug a production issue?"
- "What's your SLO?"

## Strong answer outline

1. Three pillars: logs, metrics, traces
2. Key metrics: latency, error rate, throughput
3. Alerting: what, thresholds, runbooks
4. Tracing: correlation IDs, span sampling
5. SLOs and error budget
