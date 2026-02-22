# Failure Modes

## What it is

Ways a system can fail: hardware, network, software, overload. Design for detection, mitigation, and recovery. Assume failures will happen.

## When to use it

- Design phase: identify single points of failure
- Operations: runbooks, playbooks
- Post-incident: categorize and prevent recurrence

## Tradeoffs

- Redundancy vs cost: more replicas = higher cost
- Fail fast vs retry: fail fast simplifies; retry masks transient failures
- Circuit breaker: stops cascading; adds complexity

## Failure scenarios

- Node failure: replica takes over; RTO depends on detection + failover.
- Network partition: split brain risk; quorum, fencing.
- Disk full: no writes; monitoring, alerting.
- Slow dependency: timeout, circuit breaker, fallback.
- Thundering herd: many retries; exponential backoff, jitter.
- Cascading: one failure triggers others; circuit breaker, bulkheads.

## Scaling considerations

- More nodes: more failure domains; smaller blast radius.
- Cross-region: regional outage; failover to another region.
- Chaos engineering: inject failures; validate resilience.

## Metrics to monitor

- Error rate, timeout rate
- Latency degradation
- Dependency health
- Failover events, RTO actual
- Circuit breaker trips

## Real-world examples

- Netflix Chaos Monkey: random instance kill
- Circuit breaker: stop calling failing service
- Bulkhead: isolate thread pool per dependency
- Timeout: 99% under 100ms; fail at 200ms
- Retry with exponential backoff: 1s, 2s, 4s
