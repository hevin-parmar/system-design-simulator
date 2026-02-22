# Search

## What it is

Indexing and querying text or structured data for full-text or filtered search. Inverted index maps terms to documents.

## When to use

- Full-text search over content
- Filtering, faceted search
- Autocomplete, suggestions
- Ranking by relevance

## When NOT to use

- Exact key lookup; use DB or cache
- Simple filters on primary key; DB index enough
- Small dataset; in-memory search fine

## Tradeoffs

| Elasticsearch | DB full-text |
|---------------|--------------|
| Rich search, scale-out | Simpler, single system |
| Eventual consistency | Strong consistency |
| Higher ops complexity | Lower latency for simple |

## Failure modes

- Index lag: writes delayed in search index
- Relevancy tuning: bad ranking; iterate
- Hot shards: popular terms; routing
- Cluster split: split-brain; quorum settings

## Metrics / numbers to mention

- Index latency: seconds to near-real-time
- Query latency: p99 < 100ms typical
- Sharding: by routing key for even load
- Replica count: read scaling, HA

## Common interviewer follow-ups

- "How keep search index in sync with DB?"
- "Scoring and ranking?"
- "How scale search cluster?"
- "Typo tolerance?"

## Strong sample phrasing

"Elasticsearch for full-text search. Write to DB first; async sync to search via change stream or queue. Shard by tenant_id. Replicas for read scaling. Fuzzy matching for typos."
