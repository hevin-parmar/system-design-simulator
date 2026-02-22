# Queues (Message Queues)

## What it is

Asynchronous messaging between producers and consumers. Decouples components and buffers work for processing.

## When to use

- Async processing (emails, notifications)
- Peak load buffering
- Decoupling services
- Event-driven architecture

## Tradeoffs

| Pattern | Ordering | Duplicates | Complexity |
|---------|----------|------------|------------|
| At-least-once | No guarantee | Possible | Lower |
| Exactly-once | Per-partition | No | Higher |

## Failure modes

- Consumer lag: queue grows; need to scale consumers
- Poison messages: DLQ, retries
- Ordering: partition key choice
- Message loss: replication, acknowledgments

## Numbers to mention

- Throughput: messages/sec per partition
- Lag: consumer offset behind producer
- Retention: e.g. 7 days Kafka
- Retry count, DLQ threshold

## Interview prompts

- "At-least-once or exactly-once? Why?"
- "How do you handle duplicate processing?"
- "What if a message fails 5 times?"
- "How do you handle consumer lag?"

## Strong answer outline

1. Delivery semantics and why
2. Idempotency for duplicate handling
3. DLQ and retry strategy
4. Partition key and ordering
5. Monitoring: lag, error rate
