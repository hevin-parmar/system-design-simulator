#!/usr/bin/env node
/**
 * Asserts Chat System design has required groups and 3 flows.
 */
import { createFromText } from '../agents/CreatorAgent.js'

const CHAT_INPUT = `Design Chat System

Functional Requirements:
- Users can send and receive messages in real-time
- Users can see online/offline status and typing indicators
- Users can send images and files
- Users receive push notifications when offline
- Users can list conversations and message history

Non-Functional Requirements:
- Support 100K concurrent connections
- p99 latency < 100ms for real-time delivery
- 99.99% availability
- Handle 50K messages/sec

Constraints:
- Multi-region deployment
- Eventual consistency for read receipts OK`

const REQUIRED_GROUPS = [
  { id: 'edge', label: 'Edge', requiredIds: ['api-gateway', 'edge-rate-limiter'] },
  { id: 'auth', label: 'Auth', requiredIds: ['auth-service'] },
  { id: 'realtime', label: 'Realtime', requiredIds: ['realtime-gateway', 'presence-service'] },
  { id: 'core', label: 'Core', requiredIds: ['conversation-service', 'message-service'] },
  { id: 'storage', label: 'Storage', requiredIds: ['message-store', 'conversation-metadata-store'] },
  { id: 'pipeline', label: 'Pipeline', requiredIds: ['event-log', 'worker', 'dlq'] },
  { id: 'notifications', label: 'Notifications', requiredIds: ['notification-service'] },
  { id: 'media', label: 'Media', requiredIds: ['object-storage', 'cdn', 'media-service'] },
  { id: 'observability', label: 'Observability', requiredIds: ['metrics', 'logging', 'tracing'] },
]

const REQUIRED_FLOWS = [
  { id: 'send-message-write', name: 'Send Message write path' },
  { id: 'realtime-delivery', name: 'Realtime delivery path' },
  { id: 'offline-push', name: 'Offline push path' },
]

async function main() {
  console.log('=== Chat Design Completeness Test ===\n')

  const pack = await createFromText(CHAT_INPUT)
  const nodes = pack?.diagramSpec?.nodes || []
  const nodeIds = new Set(nodes.map((n) => n.id))
  const flows = pack?.diagramSpec?.flows || []
  const checklist = pack?.diagramSpec?.completenessChecklist || []

  let failed = false

  console.log('1) Required component groups:')
  for (const g of REQUIRED_GROUPS) {
    const missing = g.requiredIds.filter((id) => !nodeIds.has(id))
    const ok = missing.length === 0
    if (!ok) failed = true
    console.log(`   ${ok ? '✓' : '✗'} ${g.label}: ${ok ? 'present' : `MISSING [${missing.join(', ')}]`}`)
  }

  console.log('\n2) Required flows:')
  for (const f of REQUIRED_FLOWS) {
    const flow = flows.find((x) => x.id === f.id || x.name === f.name)
    const ok = flow && Array.isArray(flow.path) && flow.path.length >= 2
    if (!ok) failed = true
    console.log(`   ${ok ? '✓' : '✗'} ${f.name}: ${ok ? `path length ${flow.path.length}` : 'MISSING or invalid'}`)
  }

  console.log('\n3) Node count:', nodes.length)
  console.log('   Expected: >4 (was 4 for minimal; now reference-grade)')
  if (nodes.length <= 4) {
    failed = true
    console.log('   FAIL: Chat design should have many more than 4 nodes')
  } else {
    console.log('   OK')
  }

  console.log('\n4) Node data.notes (purpose, keyDecisions, failureModes):')
  const withNotes = nodes.filter((n) => n.data?.notes || n.details?.notes)
  const sample = nodes[0]
  const hasPurpose = sample?.data?.notes?.purpose || sample?.details?.notes?.purpose
  const hasKeyDecisions = (sample?.data?.notes?.keyDecisions || sample?.details?.notes?.keyDecisions)?.length >= 2
  const hasFailureModes = (sample?.data?.notes?.failureModes || sample?.details?.notes?.failureModes)?.length >= 2
  const notesOk = hasPurpose && hasKeyDecisions && hasFailureModes
  if (!notesOk) failed = true
  console.log(`   Nodes with notes: ${withNotes.length}/${nodes.length}`)
  console.log(`   Sample has purpose: ${!!hasPurpose}, keyDecisions>=2: ${hasKeyDecisions}, failureModes>=2: ${hasFailureModes}`)
  console.log(`   ${notesOk ? '✓' : '✗'} notes structure`)

  if (checklist.length > 0) {
    console.log('\n5) Completeness checklist:')
    checklist.forEach((c) => console.log(`   ${c.present ? '✓' : '✗'} ${c.group}: ${c.nodes?.length || 0} nodes`))
  }

  console.log('\n6) High-traffic (>=50K) enhancements:')
  const msgStore = nodes.find((n) => n.id === 'message-store')
  const hasSharding = !!(msgStore?.details?.shardingStrategy || msgStore?.details?.partitionKeyGuidance)
  const hasCache = nodeIds.has('cache')
  console.log(`   Message Store sharding/partition notes: ${hasSharding ? '✓' : '✗'}`)
  console.log(`   Caching layer (traffic>=50K): ${hasCache ? '✓' : '✗'}`)
  if (!hasSharding || !hasCache) failed = true

  console.log('\n' + (failed ? '=== FAILED ===' : '=== PASSED ==='))
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
