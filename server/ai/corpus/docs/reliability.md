# Reliability

## What it is

Designing systems to continue operating correctly under failure conditions. Includes redundancy, failover, and graceful degradation.

## When to use

- High-availability requirements (99.9%+)
- Mission-critical systems
- Multi-datacenter deployment

## Tradeoffs

- Consistency vs availability
- Cost of redundancy vs blast radius
- Complexity of failover logic

## Failure modes

- Node/instance failure
- Network partition
- Cascading failure from overload
- Data corruption or loss

## Numbers to mention

- Availability targets: 99.9% (3 nines), 99.99% (4 nines)
- RTO (recovery time objective), RPO (recovery point objective)
- Replication lag in ms
- Health check interval (e.g. 10s)

## Interview prompts

- "What happens when a node fails?"
- "How do you detect and recover?"
- "What's your RTO and RPO?"

## Strong answer outline

1. Redundancy: replicas, multi-AZ
2. Detection: health checks, circuit breakers
3. Failover: automated vs manual, failover time
4. Degradation: what breaks, what keeps working
5. RTO/RPO and how you achieve them
