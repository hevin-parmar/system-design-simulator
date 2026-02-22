# Load Balancer

## What it is

A component that distributes incoming traffic across multiple backend servers. Sits between clients and application servers. Can operate at L4 (TCP/UDP) or L7 (HTTP/HTTPS).

## When to use it

- Multiple app server instances for horizontal scaling
- Need high availability—traffic must continue if one backend fails
- Want to add/remove backends without client awareness
- TLS termination or path-based routing required (L7 only)

## Tradeoffs

| Approach | Pros | Cons |
|----------|------|------|
| Round robin | Simple, stateless | Ignores load; long requests can skew distribution |
| Least connections | Adapts to request duration | Requires connection tracking |
| IP hash | Sticky without app support | Poor distribution if clients cluster; hot spots |
| L4 | Fast, low overhead | No HTTP awareness, limited routing |
| L7 | Path routing, header inspection, TLS | Higher latency, more CPU |

## Failure scenarios

- LB itself fails → single point of failure. Use multiple LBs behind DNS or anycast.
- Health check too aggressive → flapping, backends removed unnecessarily.
- Health check too slow → traffic to dead backend until detected.
- Sticky sessions → backend crash loses session; failover complexity.

## Scaling considerations

- LB throughput limits (connections/sec, bandwidth). Scale vertically or add LBs.
- Session state: avoid if possible; use external store if needed.
- Backend capacity: add instances; LB auto-discovers via health checks.
- Geographic: global LB (DNS, anycast) routes to nearest region.

## Metrics to monitor

- Request rate, error rate, latency p50/p99 per backend pool
- Active connections per backend
- Health check pass/fail rate
- LB CPU, memory, connection count
- Backend count, in/out of rotation

## Real-world examples

- NGINX, HAProxy: software LBs, L4/L7
- AWS ALB/NLB: managed, auto-scaling
- Cloudflare: global anycast, DDoS mitigation
- Sticky sessions: e-commerce cart; stateful WebSocket
