#!/usr/bin/env node
/**
 * Simulate 6 interview turns using sample pack + diagram changes.
 * Run: node server/ai/simulateInterview.js
 */
import { processTurn } from './agents/InterviewerAgent.js'
import { validateTurnInput } from './schemas/interviewTurn.js'

const SAMPLE_PACK = {
  title: 'Designing a URL Shortener',
  problemStatement: 'Users create short URLs that redirect to long URLs. Support 1M daily requests.',
  functionalRequirements: [
    'Users can create short URLs from long URLs',
    'Redirect short URL to original',
    'Optional: analytics on clicks',
  ],
  nonFunctionalRequirements: [
    'Low latency under 200ms',
    'High availability 99.9%',
    'Handle 1M daily requests',
  ],
}

const SAMPLE_NODES = [
  { id: 'client', data: { label: 'Client' } },
  { id: 'lb-1', data: { label: 'Load Balancer' } },
  { id: 'app-1', data: { label: 'App Server' } },
  { id: 'db-1', data: { label: 'Database' } },
]

const SAMPLE_EDGES = [
  { id: 'e1', source: 'client', target: 'lb-1' },
  { id: 'e2', source: 'lb-1', target: 'app-1' },
  { id: 'e3', source: 'app-1', target: 'db-1' },
]

const TURNS = [
  { lastChangeEvent: null, userText: '' },
  { lastChangeEvent: { type: 'addNode', payload: { id: 'lb-1', data: { label: 'Load Balancer' } } }, userText: '' },
  { lastChangeEvent: null, userText: 'Round robin, L7. Health checks every 10s. No sticky sessions—stateless.' },
  { lastChangeEvent: { type: 'addNode', payload: { id: 'cache-1', data: { label: 'Cache' } } }, userText: '' },
  { lastChangeEvent: null, userText: 'Cache short→long mapping. Redis, 1hr TTL. Cache-aside.' },
  { lastChangeEvent: null, userText: 'Partition key is the short code hash. No cross-shard transactions.' },
]

async function main() {
  console.log('\n=== Simulate Interview (6 turns) ===\n')
  const sessionState = { coveredSections: {}, askedComponentQuestions: {} }
  let transcript = []
  let nodes = [...SAMPLE_NODES]
  let edges = [...SAMPLE_EDGES]

  for (let i = 0; i < TURNS.length; i++) {
    const turn = TURNS[i]
    if (turn.lastChangeEvent?.type === 'addNode' && turn.lastChangeEvent?.payload) {
      const p = turn.lastChangeEvent.payload
      if (!nodes.some((n) => n.id === p.id)) nodes = [...nodes, p]
    }

    const input = validateTurnInput({
      questionPackSummary: SAMPLE_PACK,
      diagramSnapshot: { nodes, edges },
      lastChangeEvent: turn.lastChangeEvent,
      trafficLoad: 1000000,
      transcript: { lastTurns: transcript },
    })
    if (turn.userText) transcript.push({ role: 'user', text: turn.userText })
    const out = await processTurn(input, sessionState)
    transcript.push({ role: 'interviewer', text: out.interviewerMessage })
    sessionState.coveredSections = sessionState.coveredSections || {}
    sessionState.askedComponentQuestions = sessionState.askedComponentQuestions || {}

    console.log(`--- Turn ${i + 1} ---`)
    if (turn.userText) console.log(`You: ${turn.userText}`)
    console.log(`Interviewer: ${out.interviewerMessage}`)
    if (out.target?.requirementTags?.length || out.target?.nodeIds?.length) {
      console.log(`Focus: ${[...(out.target.requirementTags || []), ...(out.target.nodeIds || [])].join(', ')}`)
    }
    console.log('')
  }
  console.log('=== Done ===\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
