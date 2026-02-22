# Sharding

## What it is

Split data across multiple DB instances (shards) by partition key. Each shard holds a subset. Enables horizontal scaling beyond single-node limits.

## When to use

- Data or write throughput exceeds single-node capacity
- Read replicas don't solve write bottleneck
- Data partitionable (user_id, tenant_id)
- Can accept no cross-shard joins

## When NOT to use

- Single node sufficient; avoid complexity
- Heavy cross-shard queries; design schema to avoid
- When partition key changes often; rebalancing costly

## Tradeoffs

| Hash | Range |
|------|-------|
| Even distribution | Range queries easy |
| No range scans | Hot spots at boundaries |
| Rehash on add shards | Split hot ranges |

## Failure modes

- Hot partition: one shard overloaded. Mitigate: compound key, split hot shard.
- Rebalancing: data migration causes load; do gradually.
- Cross-shard query: expensive; avoid in hot path.
- Shard failure: that partition down; replicate shards.

## Metrics / numbers to mention

- Partition key: user_id, (user_id, timestamp)
- Shard count: start small, add as needed
- Rebalancing: online vs batch; migration lag
- Consistent hashing: reduces churn on add/remove

## Common interviewer follow-ups

- "Partition key? Why?"
- "How avoid hot partitions?"
- "Resharding strategy?"
- "Cross-shard query—how handle?"

## Strong sample phrasing

"Shard by user_id modulo N. Compound key (user_id, created_at) for time-ordered data. Hot users: sub-shard or cache. Add shards with consistent hashing to minimize data movement."
