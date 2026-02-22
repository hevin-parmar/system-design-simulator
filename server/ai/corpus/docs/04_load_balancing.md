# Load Balancing

## What it is

Distributing requests across multiple backend servers. Prevents single-server overload and improves availability.

## When to use

- Multiple app servers; need to route traffic
- Horizontal scaling; add more backends
- Health-based routing; skip unhealthy instances

## When NOT to use

- Single server; no distribution needed
- When all traffic must hit one node (e.g. primary DB)

## Tradeoffs

| Strategy | Use case |
|----------|----------|
| Round robin | Even load, stateless |
| Least connections | Uneven request duration |
| IP hash | Sticky sessions, no app support |
| L7 path-based | Route by URL, A/B test |

## Failure modes

- LB as single point of failure; use multiple LBs, DNS failover
- Slow health checks; traffic hits dead backend
- Thundering herd; all clients reconnect to same backend

## Metrics / numbers to mention

- Health check interval: 5–30 seconds
- L4 vs L7: L4 = IP/port; L7 = HTTP, path, headers
- Connection limits per backend
- Failover time (DNS TTL, health check interval)

## Common interviewer follow-ups

- "L4 or L7? Why?"
- "How do health checks work?"
- "What if the LB fails?"
- "Sticky sessions—when and how?"

## Strong sample phrasing

"L7 load balancer for path-based routing and TLS termination. Round robin with least-connections fallback. Health checks every 10s; remove backend after 2 failures. Two LBs behind DNS for failover."
