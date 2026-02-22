# Capacity Estimation

## What it is

Back-of-envelope math to size infrastructure: QPS, storage, bandwidth. Done early in design to identify bottlenecks and ballpark costs.

## When to use it

- System design interview; show quantitative thinking
- Pre-launch capacity planning
- Cost estimation
- Identifying scaling limits

## Tradeoffs

- Rough vs precise: rough is fast; precise needs real traffic.
- Assumptions matter: DAU, read/write ratio, payload size.
- Growth: 2x, 5x, 10x headroom typical.

## Failure scenarios

- Under-provisioned: overload at launch. Scale up; add caching.
- Over-provisioned: wasted cost. Right-size with monitoring.
- Wrong assumptions: traffic pattern differs. Iterate.

## Scaling considerations

- Start with reads: usually 10:1 or 100:1 read:write.
- Storage: retention × daily writes × replication factor.
- Bandwidth: request size × QPS × 2 (in + out).
- Peaks: 2–3x average common.

## Metrics to monitor

- Actual QPS vs estimated
- Storage growth vs projection
- Bandwidth utilization
- Cost vs budget

## Real-world examples

- 1M DAU, 10 requests/user/day → ~120 QPS average; 300–400 peak
- 1KB average request → 400 KB/s = 3.2 Mbps
- 100M users, 1KB profile, 3 replicas → 300 TB storage
- Order of magnitude; refine with real data
