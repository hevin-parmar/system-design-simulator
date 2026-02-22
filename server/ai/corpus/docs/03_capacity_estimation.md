# Capacity Estimation

## What it is

Back-of-envelope math: QPS, storage, bandwidth. Uses assumptions (DAU, actions/user, retention) to size components.

## When to use

- Sizing any component (servers, DB, cache)
- Validating if design can handle load
- Interview: shows you think in numbers

## When NOT to use

- Early requirements phase; need traffic assumptions first
- Micro-optimization; ballpark is enough

## Tradeoffs

| Conservative | Aggressive |
|--------------|------------|
| Over-provision, higher cost | Risk under-provision |
| Safer at launch | Requires scaling plan |

## Failure modes

- Wrong assumptions; state them explicitly
- Forgetting peak vs average (3–5x multiplier)
- Ignoring storage growth over time

## Metrics / numbers to mention

- 1M DAU × 10 requests/day ≈ 120 QPS average
- Peak: 3–5× average
- 100 bytes/row × 1B rows = 100 GB
- 1 Gbps ≈ 12.5 MB/s

## Common interviewer follow-ups

- "What's the bottleneck at that scale?"
- "How much storage for 1 year?"
- "Bandwidth between services?"
- "Number of DB connections?"

## Strong sample phrasing

"10M DAU, 20 requests/day each → 2.3k QPS average. With 5× peak, ~12k QPS. At 1KB/request, that's ~12 MB/s bandwidth. DB needs to handle 12k reads; with cache at 80% hit rate, DB sees 2.4k QPS."
