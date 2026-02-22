#!/usr/bin/env node
/**
 * Test: repeated "help" messages → agent must not repeat the same question.
 * COACH mode rotates through different follow-ups via coachFollowUpIndex.
 * Run: node server/ai/testHelpNoRepeat.js
 */
import { processTurn } from './agents/InterviewerAgent.js'
import { validateTurnInput } from './schemas/interviewTurn.js'

const PACK = {
  title: 'Design URL Shortener',
  problemStatement: 'Build a URL shortener with 10M DAU.',
  functionalRequirements: ['Shorten URL', 'Redirect'],
  nonFunctionalRequirements: ['99.9% availability'],
}

async function run() {
  console.log('=== Test: Repeated "help" → No same question ===\n')

  const sessionState = {
    askedHashes: [],
    askedQuestionHashes: [],
    askedTopics: [],
    lastTopics: [],
    lastQuestionId: '',
    difficulty: 1,
    userSkill: 0,
    skillEstimate: 0,
    mode: 'ASK',
    lastUserAnswer: '',
    lastAskedQuestions: [],
    coachFollowUpIndex: 0,
  }

  const startTurns = [
    { role: 'interviewer', text: 'At 1K RPS, your cache sits in front of DB. If one cache node fails, what happens? Give me DB QPS impact and p99.' },
    { role: 'user', text: 'help' },
  ]

  const questions = []
  for (let i = 0; i < 5; i++) {
    const turnInput = validateTurnInput({
      questionPackSummary: PACK,
      diagramSnapshot: { nodes: [{ id: 'c1', data: { label: 'Cache' } }], edges: [] },
      lastChangeEvent: null,
      trafficLoad: 1000,
      transcript: { lastTurns: startTurns },
    })
    const out = await processTurn(turnInput, sessionState)
    const msg = out.interviewerMessage || ''
    const followUp = msg.split('Try this:')[1]?.trim()?.split('.')[0]?.trim() || msg.slice(-80)
    questions.push(followUp)
    startTurns.push({ role: 'interviewer', text: msg })
    startTurns.push({ role: 'user', text: 'help' })
    startTurns.splice(0, 2)
    console.log(`Help #${i + 1} follow-up: ${followUp.slice(0, 70)}...`)
  }

  const unique = new Set(questions.map((q) => q.toLowerCase().slice(0, 50)))
  if (unique.size >= 3) {
    console.log('\n✓ PASS: Agent did not repeat the same question (got', unique.size, 'distinct follow-ups)')
  } else {
    console.log('\n⚠ FAIL: Expected 3+ distinct follow-ups, got', unique.size)
    process.exit(1)
  }

  console.log('=== Done ===')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
