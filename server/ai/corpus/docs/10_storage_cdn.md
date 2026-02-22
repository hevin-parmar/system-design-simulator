# Storage & CDN

## What it is

**Object storage:** Blob storage (S3-style) for images, videos, backups. **CDN:** Edge caches to serve static assets close to users.

## When to use

- Large files: images, videos, backups
- Static assets: JS, CSS, images
- Global low-latency delivery
- Immutable content; cache aggressively

## When NOT to use

- Dynamic, personalized content; cache hit rate low
- Small API responses; CDN overhead not worth it
- Strong consistency required; CDN has propagation delay

## Tradeoffs

| Object storage | Block storage |
|----------------|---------------|
| Scale, cheap | Low latency, mutable |
| Eventual consistency | Strong consistency |
| HTTP API | Attached to instance |

## Failure modes

- CDN cache invalidation: propagation delay (minutes)
- Origin overload: CDN miss storm; warm cache
- Region failure: multi-region origin
- Cost: egress expensive; optimize cache hit rate

## Metrics / numbers to mention

- CDN hit rate: 90%+ for static
- Invalidation: purge by path or full
- Object storage: multipart upload for large files
- Edge locations: dozens to hundreds

## Common interviewer follow-ups

- "Cache invalidation strategy?"
- "What if origin goes down?"
- "How handle dynamic content?"
- "Cost model—egress?"

## Strong sample phrasing

"Static assets on object storage. CDN in front; TTL 24h for immutable, versioned URLs. Invalidate on deploy by path prefix. Multi-region origin for resilience."
