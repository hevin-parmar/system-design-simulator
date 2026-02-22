#!/usr/bin/env node
/**
 * Test InterviewerAgent RAG: 5 scenarios.
 * Run: node server/ai/testInterviewerRAG.js
 */
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { processTurn } from './agents/InterviewerAgent.js'
import { validateTurnInput } from './schemas/interviewTurn.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

execSync('node server/ai/tools/buildCorpus.js', {
  cwd: path.join(__dirname, '../..'),
  stdio: 'pipe',
})

const PACK = {
  title: 'Design URL Shortener',
  problemStatement: 'Build a URL shortener with 10M DAU.',
  functionalRequirements: ['Shorten URL', 'Redirect'],
  nonFunctionalRequirements: ['99.9% availability'],
}

const START = [
  { role: 'interviewer', text: "Let's scope this." },
  { role: 'user', text: '10M DAU, shorten and redirect.' },
]

async function run(scenario, turnInput, sessionState) {
  return await processTurn(turnInput, sessionState)
}

async function main() {
  console.log('=== Interviewer RAG Test (5 scenarios) ===\n')

  // 1) Add Cache + weak answer
  let mem = {
    askedHashes: [],
    askedQuestionHashes: [],
    lastTopics: [],
    lastTopicTags: [],
    difficulty: 1,
    userSkill: 0,
    lastUserAnswer: '',
    lastUserAnswerSummary: '',
    lastActionSummary: '',
    noOpJustifyAttempts: 0,
  }
  const t1 = validateTurnInput({
    questionPackSummary: PACK,
    diagramSnapshot: { nodes: [], edges: [] },
    lastChangeEvent: { type: 'addNode', kind: 'addNode', payload: { id: 'c1', type: 'cache', data: { label: 'Cache' } } },
    trafficLoad: 1000,
    transcript: { lastTurns: START },
  })
  const out1 = await run('Add Cache', t1, mem)
  console.log('1) Add Cache + (no answer yet):')
  console.log('   difficulty:', mem.difficulty, '| topic:', mem.lastTopics?.[mem.lastTopics.length - 1] || 'cache')
  console.log('   Q:', (out1.interviewerMessage || '').split('\n')[0])
  console.log('')

  // 2) Add Cache + strong answer with TTL
  mem = { ...mem, askedHashes: mem.askedHashes || mem.askedQuestionHashes, askedQuestionHashes: mem.askedHashes || mem.askedQuestionHashes }
  const t2 = validateTurnInput({
    questionPackSummary: PACK,
    diagramSnapshot: { nodes: [{ id: 'c1', type: 'cache', data: { label: 'Cache' } }], edges: [] },
    lastChangeEvent: null,
    trafficLoad: 1000,
    transcript: {
      lastTurns: [...START, { role: 'interviewer', text: out1.interviewerMessage }, { role: 'user', text: 'Write-through with 5 min TTL; single-flier on miss to prevent stampede; 80% hit rate target.' }],
    },
  })
  const out2 = await run('Strong answer', t2, mem)
  console.log('2) Add Cache + strong answer (TTL, numbers):')
  console.log('   difficulty:', mem.difficulty, '| topic:', mem.lastTopics?.[mem.lastTopics.length - 1])
  console.log('   Q:', (out2.interviewerMessage || '').split('\n')[0])
  console.log('')

  // 3) Add Queue + answer about async
  mem = { askedHashes: [], askedQuestionHashes: [], lastTopics: [], lastTopicTags: [], difficulty: 1, userSkill: 2, lastUserAnswer: '', lastActionSummary: '', noOpJustifyAttempts: 0 }
  const t3 = validateTurnInput({
    questionPackSummary: PACK,
    diagramSnapshot: { nodes: [], edges: [] },
    lastChangeEvent: { type: 'addNode', kind: 'addNode', payload: { id: 'mq1', type: 'default', data: { label: 'Message Queue' } } },
    trafficLoad: 1000,
    transcript: { lastTurns: START },
  })
  const out3 = await run('Add Queue', t3, mem)
  console.log('3) Add Queue:')
  console.log('   difficulty:', mem.difficulty, '| topic:', mem.lastTopics?.[mem.lastTopics.length - 1] || 'queue')
  console.log('   Q:', (out3.interviewerMessage || '').split('\n')[0])

  const t3b = validateTurnInput({
    questionPackSummary: PACK,
    diagramSnapshot: { nodes: [{ id: 'mq1', data: { label: 'Message Queue' } }], edges: [] },
    lastChangeEvent: null,
    trafficLoad: 1000,
    transcript: { lastTurns: [...START, { role: 'interviewer', text: out3.interviewerMessage }, { role: 'user', text: 'To decouple and handle async processing.' }] },
  })
  const out3b = await run('Queue + async answer', t3b, mem)
  console.log('   Follow-up Q:', (out3b.interviewerMessage || '').split('\n')[0])
  console.log('')

  // 4) Add Shard + vague answer
  mem = { askedHashes: [], askedQuestionHashes: [], lastTopics: [], lastTopicTags: [], difficulty: 1, userSkill: 0, lastUserAnswer: '', lastActionSummary: '', noOpJustifyAttempts: 0 }
  const t4 = validateTurnInput({
    questionPackSummary: PACK,
    diagramSnapshot: { nodes: [], edges: [] },
    lastChangeEvent: { type: 'addNode', kind: 'addNode', payload: { id: 's1', type: 'default', data: { label: 'Shard 1' } } },
    trafficLoad: 1000,
    transcript: { lastTurns: START },
  })
  const out4 = await run('Add Shard', t4, mem)
  console.log('4) Add Shard:')
  console.log('   difficulty:', mem.difficulty, '| topic:', mem.lastTopics?.[mem.lastTopics.length - 1] || 'shard')
  console.log('   Q:', (out4.interviewerMessage || '').split('\n')[0])

  const t4b = validateTurnInput({
    questionPackSummary: PACK,
    diagramSnapshot: { nodes: [{ id: 's1', data: { label: 'Shard 1' } }], edges: [] },
    lastChangeEvent: null,
    trafficLoad: 1000,
    transcript: { lastTurns: [...START, { role: 'interviewer', text: out4.interviewerMessage }, { role: 'user', text: 'idk' }] },
  })
  const out4b = await run('Shard + vague', t4b, mem)
  console.log('   After vague: ', (out4b.interviewerMessage || '').slice(0, 80) + '...')
  console.log('')

  // 5) Add duplicate Client (no-op)
  mem = {
    askedHashes: [],
    askedQuestionHashes: [],
    lastTopics: [],
    lastTopicTags: [],
    difficulty: 1,
    userSkill: 0,
    lastUserAnswer: '',
    lastActionSummary: '',
    noOpJustifyAttempts: 0,
  }
  const nodesWithClient = [
    { id: 'client1', type: 'default', data: { label: 'Client' } },
    { id: 'lb1', type: 'default', data: { label: 'Load Balancer' } },
    { id: 'client2', type: 'default', data: { label: 'Client' } },
  ]
  const t5 = validateTurnInput({
    questionPackSummary: PACK,
    diagramSnapshot: { nodes: nodesWithClient, edges: [] },
    lastChangeEvent: { type: 'addNode', kind: 'addNode', payload: { id: 'client2', type: 'default', data: { label: 'Client' } } },
    trafficLoad: 1000,
    transcript: { lastTurns: START },
  })
  const out5 = await run('Duplicate Client (no-op)', t5, mem)
  const isNoOpQ = /unnecessary|what problem does it solve/i.test(out5.interviewerMessage || '')
  console.log('5) Add duplicate Client (no-op):')
  console.log('   no-op detected:', isNoOpQ)
  console.log('   Q:', (out5.interviewerMessage || '').split('\n')[0])
  console.log('')

  console.log('=== Done ===')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
