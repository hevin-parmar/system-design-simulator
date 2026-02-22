# Messaging Queues

## What it is

Async buffer between producers and consumers. Decouples services, absorbs spikes, enables event-driven workflows.

## When to use

- Decouple producer from consumer; async processing
- Absorb traffic spikes; queue buffers bursts
- Fan-out: one event, many consumers
- At-least-once delivery with retries

## When NOT to use

- Synchronous response required
- Strong ordering across all messages; use single partition
- When duplicates unacceptable and idempotency hard

## Tradeoffs

| At-least-once | Exactly-once |
|---------------|--------------|
| Duplicates possible | No duplicates |
| Simpler | Idempotency, dedup |
| Retry, DLQ | Transactional outbox |

## Failure modes

- Consumer lag: queue grows; backpressure or scale consumers
- Poison message: crashes consumer; DLQ
- Ordering: partition by key; global order costly
- Queue full: producers block; capacity planning

## Metrics / numbers to mention

- Delivery semantics: at-least-once common
- DLQ: messages after N retries
- Backpressure: block producer when lag high
- Partition count: parallelism; rebalancing cost

## Common interviewer follow-ups

- "At-least-once or exactly-once?"
- "How handle duplicates?"
- "DLQ strategy?"
- "Backpressure when consumer slow?"

## Strong sample phrasing

"At-least-once delivery. Consumer processes and acks; on failure, message re-queued. Idempotent keys for dedup. DLQ after 5 retries. Backpressure: reject publish when lag > 10k."
