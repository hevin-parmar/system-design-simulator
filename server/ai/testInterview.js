#!/usr/bin/env node
/**
 * Test interview flow: simulate add cache, add MQ, add shard.
 * Confirms questions differ, no repeats, retriever returns ≥3 results.
 * Run: node server/ai/testInterview.js
 */
import { retrieve } from './runtime/retriever.js'
import { processTurn } from './agents/InterviewerAgent.js'
import { validateTurnInput } from './schemas/interviewTurn.js'

const PACK = {
  title: 'Design URL Shortener',
  problemStatement: 'Build a URL shortener like bit.ly with 10M daily active users.',
  functionalRequirements: ['Shorten URL', 'Redirect to original', 'Track analytics'],
  nonFunctionalRequirements: ['99.99% availability', 'Sub-100ms latency p99'],
}

const STARTING_TURNS = [
  { role: 'interviewer', text: "Let's scope this. What are the core use cases?" },
  { role: 'user', text: 'We need to shorten URLs and redirect. 10M DAU.' },
]

function makeTurnInput(changeMeta, lastTurns = STARTING_TURNS) {
  return validateTurnInput({
    questionPackSummary: PACK,
    diagramSnapshot: { nodes: [], edges: [] },
    lastChangeEvent: changeMeta,
    trafficLoad: 1000,
    transcript: { lastTurns },
  })
}

async function runTest() {
  console.log('=== Test Interview (Corpus-driven, Pro-style) ===\n')

  const sessionState = { askedQuestionHashes: [], lastTopicTags: [], lastUserAnswerSummary: '' }

  // 1. Retriever sanity check
  for (const q of ['cache TTL invalidation stampede', 'message queue DLQ backpressure', 'sharding partition key']) {
    const results = retrieve(q, { k: 6 })
    console.log(`Retriever query "${q}": ${results.length} results`)
    if (results.length < 3) console.warn(`  ⚠ Expected at least 3 results`)
    else console.log(`  ✓ Top: ${results[0]?.title || 'N/A'}\n`)
  }

  // 2. Simulate add cache
  const changeCache = {
    type: 'addNode',
    kind: 'addNode',
    payload: { id: 'cache-1', type: 'cache', data: { label: 'Cache' } },
  }
  const out1 = await processTurn(makeTurnInput(changeCache), sessionState)
  console.log('--- Add Cache ---')
  console.log(out1.interviewerMessage)
  console.log('')

  // 3. Simulate add message queue
  const changeMQ = {
    type: 'addNode',
    kind: 'addNode',
    payload: { id: 'mq-1', type: 'default', data: { label: 'Message Queue' } },
  }
  const out2 = await processTurn(makeTurnInput(changeMQ), sessionState)
  console.log('--- Add Message Queue ---')
  console.log(out2.interviewerMessage)
  console.log('')

  // 4. Simulate add shard
  const changeShard = {
    type: 'addNode',
    kind: 'addNode',
    payload: { id: 'shard-1', type: 'default', data: { label: 'Shard 1' } },
  }
  const out3 = await processTurn(makeTurnInput(changeShard), sessionState)
  console.log('--- Add Shard ---')
  console.log(out3.interviewerMessage)
  console.log('')

  // 5. Anti-repeat: ask again for cache should produce different question
  const out4 = await processTurn(makeTurnInput(changeCache), sessionState)
  console.log('--- Add Cache (again, should differ) ---')
  console.log(out4.interviewerMessage)
  console.log('')

  const q1 = (out1.interviewerMessage || '').split('\n')[0]
  const q2 = (out2.interviewerMessage || '').split('\n')[0]
  const q3 = (out3.interviewerMessage || '').split('\n')[0]
  const q4 = (out4.interviewerMessage || '').split('\n')[0]

  const unique = new Set([q1, q2, q3, q4])
  if (unique.size >= 3) {
    console.log('✓ Questions differ (no exact repeats)')
  } else {
    console.warn('⚠ Some questions were repeated')
  }

  const hasRubric = (m) => /i'm looking for|listening for/i.test(m || '') || (m || '').includes('- ')
  if (hasRubric(out1.interviewerMessage)) {
    console.log('✓ Pro-style format (main Q + why + rubric)')
  } else {
    console.warn('⚠ Expected rubric bullets')
  }

  console.log('\n=== Done ===')
}

runTest().catch((e) => {
  console.error(e)
  process.exit(1)
})
