# Sharding

## What it is

Horizontal partitioning of data across multiple DB nodes. Each shard holds a subset of data by partition key.

## When to use

- Data exceeds single-node capacity
- Need horizontal write scale
- Hot partition avoidance via key distribution

## Tradeoffs

- Partition key choice: avoid hot shards
- Cross-shard queries: expensive or impossible
- Resharding: complex migration

## Failure modes

- Hot shard: one partition gets disproportionate load
- Resharding: data migration, downtime risk
- Cross-shard transactions: 2PC complexity

## Numbers to mention

- Shard count, QPS per shard
- Partition key cardinality
- Rebalancing time
- Cross-shard query cost

## Interview prompts

- "How do you choose a partition key?"
- "What if one shard is hot?"
- "How do you add shards?"
- "Cross-shard transactions?"

## Strong answer outline

1. Partition key and why (avoid hot spots)
2. Shard count and growth
3. Hot partition mitigation
4. Resharding strategy
5. Cross-shard queries: avoid or accept cost
