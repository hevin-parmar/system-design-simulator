#!/usr/bin/env node
/**
 * Unit-like test for CreatorAgent knowledge-driven synthesis.
 * Prints: components count, normalization, Design Twitter node list.
 * Goal: 0 weak nodes.
 */
import { loadComponents } from '../knowledge/loadKnowledge.js'
import { normalizeVendorTerms } from '../knowledge/vendorNormalizer.js'
import { createFromText } from '../agents/CreatorAgent.js'

const TWITTER_INPUT = `Design Twitter

Functional Requirements:
- Users can post tweets (max 280 chars)
- Users can follow other users and see a timeline of tweets from people they follow
- Users can like, retweet, and reply to tweets
- Users can search tweets and user profiles
- Users can receive real-time notifications
- Users can send direct messages

Non-Functional Requirements:
- Support 500M+ users, 10K tweets/sec write, 300K reads/sec for timeline
- p99 latency < 200ms for timeline
- 99.99% availability
- Real-time feed updates
- Handle viral events (trending topics)

Constraints:
- Multi-region deployment
- Eventual consistency acceptable for timeline
- Assume existing auth system`

console.log('=== CreatorAgent Knowledge Test ===\n')

// 1. Components loaded count
const components = loadComponents()
console.log('1) Components loaded count:', components.length)

// 2. Sample normalization mapping for 5 vendor terms
const vendorTerms = ['Kafka', 'S3', 'Elasticsearch', 'Redis', 'DynamoDB']
console.log('\n2) Sample normalization (vendor term -> canonical id):')
for (const term of vendorTerms) {
  const normalized = normalizeVendorTerms(term)
  const canonical = normalized === term ? '(no mapping)' : normalized
  console.log(`   "${term}" -> "${canonical}"`)
}

// 3. Generate design for "Design Twitter"
console.log('\n3) Design Twitter - generated node list:')
const pack = await createFromText(TWITTER_INPUT)
const nodes = pack?.diagramSpec?.nodes || []
const weakCount = nodes.filter((n) => n.meta?.flag === 'weak').length
const totalNodes = nodes.length
const removedCount = pack?.diagramSpec?.meta?.removedCount ?? 0

console.log(`   Weak nodes: ${weakCount} (goal: 0)`)
console.log(`   Total nodes: ${totalNodes}`)
console.log(`   Removed nodes (could not justify): ${removedCount}`)

if (nodes.length <= 10) {
  console.log('   WARNING: Expected >10 components for Twitter design')
} else {
  console.log('   OK: >10 components')
}
console.log('   Nodes:')
for (const n of nodes) {
  const reasons = n.justification?.reasons?.length || 0
  const metricPreview = n.justification?.metrics?.expectedLoad ? ' [metrics]' : ''
  console.log(`     - ${n.id} (${n.label}) | reasons: ${reasons}${metricPreview}`)
}

console.log('\n=== Done ===')
