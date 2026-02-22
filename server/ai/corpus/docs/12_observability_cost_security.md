# Observability, Cost & Security

## What it is

**Observability:** Logs, metrics, traces to understand and debug system. **Cost:** Storage tiering, right-sizing. **Security:** Auth, encryption, compliance.

## When to use

- Production readiness; can't operate blind
- Cost-sensitive; tier storage, optimize
- PII, compliance; encrypt, audit

## When NOT to use

- Early design; focus on core flow first
- When not asked; mention briefly

## Tradeoffs

| Observability | Cost |
|---------------|------|
| More data = better debugging | More data = higher cost |
| Sampling for high volume | Retention limits |
| Structured logs vs free text | Hot vs cold storage |

## Failure modes

- Log explosion: cost, noise; sample, aggregate
- No tracing: hard to debug across services
- Keys in logs: security leak
- Under-provisioned: outages; over: waste

## Metrics / numbers to mention

- SLI/SLO: p99 latency, error rate
- Error budget: 99.9% = 43 min/month
- Retention: logs 7–30 days; metrics 90 days
- Auth: OAuth2, JWT, mTLS

## Common interviewer follow-ups

- "How debug production issue?"
- "What metrics alert on?"
- "Cost at scale?"
- "How secure user data?"

## Strong sample phrasing

"Structured logs, metrics (QPS, latency, errors), distributed tracing. Alert on error rate, p99 latency. Encrypt at rest and in transit; auth via JWT. PII hashed or tokenized."
