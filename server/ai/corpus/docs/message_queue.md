# Message Queue

## What it is

Asynchronous buffer between producers and consumers. Producers publish messages; consumers process when ready. Decouples services, absorbs spikes, enables async workflows.

## When to use it

- Decouple services; producer doesn't wait for consumer
- Absorb traffic spikes; queue buffers bursts
- Async processing (email, notifications, background jobs)
- Event-driven architecture; multiple consumers per event

## Tradeoffs

| Semantics | Duplicates | Complexity |
|-----------|------------|------------|
| At-least-once | Possible | Low |
| At-most-once | No; may lose | Low |
| Exactly-once | No | High; idempotency, dedup |

## Failure scenarios

- Consumer slow: queue grows. Backpressure: block/reject producers.
- Consumer crash: unacked messages re-queued. At-least-once = duplicates.
- Queue full: producers blocked or reject. Need capacity planning.
- Message poison: bad message crashes consumer repeatedly. DLQ.
- Ordering: partition by key; global order expensive.

## Scaling considerations

- Partition by key for parallelism; order within partition.
- Consumer groups: each partition consumed by one consumer in group.
- Add partitions for more parallelism; rebalancing overhead.
- Retention: longer = more storage; shorter = replay window.

## Metrics to monitor

- Queue depth, lag (messages behind)
- Publish rate, consume rate
- Latency: produce ack, end-to-end
- DLQ depth, dead-letter rate
- Consumer lag per partition
- Error rate, retry count

## Real-world examples

- Kafka: event log, high throughput
- RabbitMQ: flexible routing, various protocols
- SQS: managed, at-least-once
- Order processing: queue orders; inventory service consumes
- Notifications: fan-out to email, push, SMS
