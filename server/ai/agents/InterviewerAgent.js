/**
 * InterviewerAgent: elite system design interviewer.
 * Session memory, action→topic mapping, retrieval, no-repeat, help mode, no-op flag.
 */
import { generate } from '../runtime/llamaRuntime.js'
import { validateTurnInput, validateTurnOutput } from '../schemas/interviewTurn.js'
import { appendInterviewerMemory } from '../../storage/index.js'
import { retrieve } from '../runtime/retriever.js'
import {
  getOrInitSessionMemory,
  updateUserSkill,
  recordQuestion,
  questionHash,
  wasAsked,
  toPersistable,
} from '../interviewSessionState.js'
import {
  getTopicsForAction,
  getActionSummary,
  detectNoOp,
  getTopicFromPayload,
} from '../actionTopicMap.js'
import {
  buildRetrievalQuery,
  composeInterviewerQuestion,
  extractDiagramContext,
} from '../questionComposer.js'

const SECTIONS = ['requirements', 'hld', 'apis_data', 'scaling', 'consistency', 'failure', 'security', 'wrap_up']
const SECTION_OPENERS = {
  requirements: "Let's scope this. What are the core use cases and non-negotiables?",
  hld: "Walk me through the high-level architecture and data flow.",
  apis_data: "Define the main APIs and data model.",
  scaling: "Given your traffic numbers, run the scaling math.",
  consistency: "What consistency guarantees do you need?",
  failure: "What are the failure modes? How do you detect, mitigate, and recover?",
  security: "Security and privacy—auth, encryption, PII handling?",
  wrap_up: "Summarize the strengths and risks. One improvement with more time?",
}

const COACH_TRIGGERS = [
  "i don't know", "i dont know", "don't know", "dont know", "not sure",
  "teach", "teach me", "help", "what do you mean", "confused", "can you explain",
  "idk", "explain", "no idea", "help me",
]

const CLARIFY_TRIGGERS = ['yes', 'ok', 'done', 'sure', 'yep']

const OFFTOPIC_TRIGGERS = [
  'weather', 'lunch', 'dinner', 'joke', 'tell me a joke', 'unrelated',
  'off topic', 'of topic', 'wrong question', 'different subject',
  'how are you', 'what time', 'weekend', 'vacation', 'movie',
]

const MAX_REPEAT_ATTEMPTS = 5
const LAST_ASKED_COUNT = 3

/** Classify user reply: ANSWER | CONFUSED_HELP | OFFTOPIC. Maps to COACH/CLARIFY/EVALUATE/ASK internally. */
function classifyUserReplyType(userMessage) {
  const t = (userMessage || '').trim().toLowerCase()
  if (!t || t === '[Ready to start]' || t === '[Starting interview]') return null

  for (const phrase of OFFTOPIC_TRIGGERS) {
    if (t.includes(phrase)) return 'OFFTOPIC'
  }

  for (const phrase of COACH_TRIGGERS) {
    if (t.includes(phrase)) return 'CONFUSED_HELP'
  }

  const words = t.split(/\s+/).length
  if (words <= 4) {
    const shortOk = CLARIFY_TRIGGERS.some((c) => t === c || t.startsWith(c + ' ') || t === c + '.')
    if (shortOk) return 'ANSWER' // treat as minimal answer, will use CLARIFY flow
  }

  if (words > 15) return 'ANSWER'
  return 'ANSWER'
}

function formatQuestion(out) {
  const parts = [out.main]
  if (out.why) parts.push(out.why)
  if (out.lookingFor?.length) {
    parts.push("I'm looking for: " + out.lookingFor.join(', '))
  } else if (out.listening?.length) {
    parts.push("I'm looking for: " + out.listening.join(', '))
  }
  if (out.followUp) parts.push(out.followUp)
  return parts.join(' ')
}

/** Internal intent: COACH (CONFUSED_HELP), CLARIFY (short answer), EVALUATE (long answer), ASK, OFFTOPIC */
function classifyUserIntent(userMessage) {
  const type = classifyUserReplyType(userMessage)
  if (!type) return null
  if (type === 'OFFTOPIC') return 'OFFTOPIC'
  if (type === 'CONFUSED_HELP') return 'COACH'

  const t = (userMessage || '').trim().toLowerCase()
  const words = t.split(/\s+/).length
  if (words <= 4 && CLARIFY_TRIGGERS.some((c) => t === c || t.startsWith(c + ' ') || t === c + '.')) return 'CLARIFY'
  if (words > 15) return 'EVALUATE'
  return 'ASK'
}

function isSimilarToLast(q, lastAsked = []) {
  const a = (q || '').toLowerCase().replace(/\s+/g, ' ').slice(0, 80)
  for (const prev of lastAsked) {
    const b = (prev || '').toLowerCase().replace(/\s+/g, ' ').slice(0, 80)
    if (a === b || (a.length > 20 && b.length > 20 && (a.includes(b.slice(0, 30)) || b.includes(a.slice(0, 30))))) return true
  }
  return false
}

const COACH_FOLLOWUPS = {
  cache: [
    'If hit rate dropped from 90% to 70%, how much would DB QPS increase?',
    'What TTL would you use for user profiles vs trending content?',
    'How would you invalidate cache when data changes?',
    'What happens if Redis goes down—do you have a fallback?',
  ],
  queue: [
    'If a message fails 5 times, where does it go and how do you handle it?',
    'At-least-once or exactly-once—which and why?',
    'How do you make duplicate processing safe?',
    'What metric would you alert on for consumer lag?',
  ],
  shard: [
    'If one shard gets 3x the load of others, what would you do?',
    'How do you choose a partition key?',
    'What happens when you add a new shard—rebalancing?',
    'How would you handle a cross-shard query?',
  ],
  component: [
    'What metric would you alert on first?',
    'What is your target p99 latency in ms?',
    'What tradeoff are you explicitly accepting?',
    'Describe one failure mode for this component.',
  ],
}

function getCoachResponse(context, coachFollowUpIndex = 0) {
  const lastQ = (context.lastInterviewerMessage || '').split('.')[0].trim()
  const traffic = context.trafficLoad ?? 1000
  const rps = traffic >= 1000 ? `${Math.round(traffic / 1000)}K` : traffic
  const readRatio = '9:1'

  const topic = lastQ.toLowerCase().includes('cache') ? 'cache'
    : lastQ.toLowerCase().includes('queue') ? 'queue'
    : lastQ.toLowerCase().includes('shard') ? 'shard'
    : 'component'

  const explanations = {
    cache: {
      line: 'A cache sits between your app and DB to avoid hitting the database for repeated reads.',
      bullets: ['Think: what happens on cache miss vs hit?', 'Consider: TTL (how stale is OK?) and invalidation on write', 'Failure: if cache dies, all traffic hits DB—what’s the impact?'],
      example: `At ${rps} RPS with ${readRatio} read ratio: 90% hit rate means 0.1 × ${rps} = DB load. If cache fails, DB sees full ${rps} RPS.`,
      followUp: 'If hit rate dropped from 90% to 70%, how much would DB QPS increase?',
    },
    queue: {
      line: 'A message queue decouples producer and consumer; messages are buffered until consumed.',
      bullets: ['Think: at-least-once vs exactly-once—duplicates or drops?', 'Consider: retries, DLQ for poison messages, backpressure', 'Failure: consumer lag—queue grows; how do you alert?'],
      example: `At ${rps} RPS: if consumer processes 500/sec, lag grows by 500/sec. Need to scale consumers or backpressure.`,
      followUp: 'If a message fails 5 times, where does it go and how do you handle it?',
    },
    shard: {
      line: 'Sharding splits data by partition key so each shard holds a subset; enables horizontal scale.',
      bullets: ['Think: partition key choice—avoid hot shards', 'Consider: rebalancing when adding shards, cross-shard queries', 'Failure: one shard down—that partition unavailable'],
      example: `At ${rps} RPS across 4 shards: ~${Math.round(traffic / 4)}/shard. Hot user could overload one shard.`,
      followUp: 'If one shard gets 3x the load of others, what would you do?',
    },
    component: {
      line: 'Each component has tradeoffs: latency vs consistency, cost vs performance.',
      bullets: ['State your choice clearly', 'Give one number (QPS, TTL, p99)', 'Describe one failure mode'],
      example: `At ${rps} RPS, state expected p99 latency and one thing that could break.`,
      followUp: 'What metric would you alert on first?',
    },
  }

  const ex = explanations[topic] || explanations.component
  const followUps = COACH_FOLLOWUPS[topic] || COACH_FOLLOWUPS.component
  const followUp = followUps[coachFollowUpIndex % followUps.length]
  const out = [ex.line]
  ex.bullets.forEach((b) => out.push('• ' + b))
  out.push(`Worked example: ${ex.example}`)
  out.push(`Try this: ${followUp}`)
  return out.join(' ')
}

function getClarifyResponse(context) {
  const lastQ = (context.lastInterviewerMessage || '').toLowerCase()
  const traffic = context.trafficLoad ?? 1000
  const rps = traffic >= 1000 ? Math.round(traffic / 1000) : 1

  if (lastQ.includes('cache')) {
    return `Assume cache hit rate is 90%. If a cache node fails and hit rate drops to 70%, what happens to DB QPS? (Rough number is fine.)`
  }
  if (lastQ.includes('queue')) {
    return `Assume at-least-once delivery. One message is processed twice. How do you make that safe?`
  }
  if (lastQ.includes('shard')) {
    return `You have 4 shards. One user generates 40% of traffic. Which shard is hot and what’s the impact?`
  }
  return `Pick one: what’s your target p99 latency in ms, or your expected QPS per component?`
}

function getEvaluateResponse(context, userAnswer) {
  const t = (userAnswer || '').toLowerCase()
  const hasNumbers = /\d+/.test(userAnswer)
  const hasTradeoff = /vs|tradeoff|consistency|latency|cost/i.test(userAnswer)
  const hasFailure = /fail|down|crash|stampede|dlq|retry/i.test(userAnswer)

  const strong = []
  const missing = []
  if (hasNumbers) strong.push('You included numbers')
  else missing.push('Concrete numbers (QPS, TTL, p99)')
  if (hasTradeoff) strong.push('You mentioned a tradeoff')
  else missing.push('Explicit tradeoff (e.g. latency vs consistency)')
  if (hasFailure) strong.push('You addressed a failure mode')
  else missing.push('Failure mode or containment')
  if (strong.length === 0) strong.push('You engaged with the question')
  if (missing.length === 0) missing.push('Operational detail (metrics, alerting)')

  const sharper = !hasNumbers
    ? 'What’s the ballpark QPS and p99 for this path?'
    : !hasFailure
      ? 'What happens when this component fails—and how do you detect it?'
      : 'What tradeoff are you explicitly accepting (cost, latency, consistency)?'

  return `Good. Here’s what’s strong / missing: Strong: ${strong.slice(0, 2).join('; ')}. Missing: ${missing.slice(0, 2).join('; ')}. ${sharper}`
}

function detectVague(text) {
  const t = (text || '').trim()
  if (t.length < 15) return "That's quite brief. What specific tradeoffs, numbers, or failure modes?"
  if (/for performance|to handle load|it depends|probably|maybe|we can|we could/i.test(t)) {
    return "I need a concrete decision. What's your expected QPS? What specifically is the bottleneck?"
  }
  return null
}

function detectWrong(text) {
  if (/lb controls client|load balancer controls/i.test(text)) return "LB routes requests; it doesn't control clients."
  if (/cache is always consistent/i.test(text)) return "Caches introduce consistency challenges. What invalidation strategy?"
  if (/mq guarantees order/i.test(text)) return "Message queues often don't guarantee global ordering. How are you handling partitions?"
  return null
}

const ASK_ANGLES = ['ops', 'failure', 'metrics', 'tradeoff', 'cost']

function pickNextQuestion(context, mem) {
  const { pack, lastChangeEvent, lastUserText, nodes, edges, trafficLoad } = context
  const changeType = lastChangeEvent?.type || lastChangeEvent?.kind
  const payload = lastChangeEvent?.payload || lastChangeEvent?.details
  const lastAsked = mem.lastAskedQuestions || []

  const topic = changeType === 'addNode' && payload ? getTopicFromPayload(payload) : 'default'
  const topics = getTopicsForAction(changeType, payload)
  const actionSummary = getActionSummary(changeType, payload, nodes, edges)
  const isNoOp = detectNoOp(changeType, payload, nodes, edges)
  const diagramContext = extractDiagramContext(nodes, edges, changeType === 'addNode' ? payload : null)

  const diff = mem.difficulty
  let query = buildRetrievalQuery(actionSummary, lastUserText || mem.lastUserAnswer, diff, topics)
  let chunks = retrieve(query, { k: 10 })

  for (let attempt = 0; attempt < MAX_REPEAT_ATTEMPTS; attempt++) {
    const angle = ASK_ANGLES[attempt % ASK_ANGLES.length]
    if (attempt > 0) query = query + ' ' + angle
    if (attempt > 1) chunks = retrieve(query, { k: 10 })

    const offset = attempt * 2
    const slice = chunks.slice(offset, offset + 4)
    const composed = composeInterviewerQuestion({
      topic,
      chunks: slice.length ? slice : chunks.slice(0, 2),
      difficulty: diff,
      isNoOpFlag: isNoOp,
      userAnswer: lastUserText || mem.lastUserAnswer,
      diagramContext,
      trafficLoad,
      actionSummary,
    })

    const h = questionHash(composed.main)
    const mainLine = (composed.main || '').split('.')[0].trim()
    if (!wasAsked(mem, composed.main) && !isSimilarToLast(mainLine, lastAsked)) {
      return { composed, hash: h, mainLine }
    }
  }

  const fallback = composeInterviewerQuestion({
    topic,
    chunks: chunks.slice(0, 2),
    difficulty: diff,
    isNoOpFlag: false,
    userAnswer: '',
    diagramContext,
    trafficLoad,
    actionSummary,
  })
  fallback.main = `Different angle: ${fallback.main}`
  return { composed: fallback, hash: questionHash(fallback.main), mainLine: fallback.main.split('.')[0].trim() }
}

function heuristicTurn(input, sessionState = {}) {
  const { questionPackSummary: pack, diagramSnapshot, lastChangeEvent, transcript } = input
  const nodes = diagramSnapshot?.nodes || []
  const edges = diagramSnapshot?.edges || []
  const lastTurns = transcript?.lastTurns || []
  const lastUser = lastTurns.filter((t) => t.role === 'user').pop()
  const lastInterviewer = lastTurns.filter((t) => t.role === 'interviewer').pop()
  const lastUserText = (lastUser?.text || '').trim()

  let mem = getOrInitSessionMemory({
    ...sessionState,
    askedHashes: sessionState.askedQuestionHashes || sessionState.askedHashes,
    lastTopics: sessionState.lastTopicTags || sessionState.lastTopics,
  })

  const trafficLoad = input.trafficLoad ?? 1000
  const context = {
    pack,
    lastChangeEvent,
    lastUserText,
    nodes,
    edges,
    trafficLoad,
    lastInterviewerMessage: lastInterviewer?.text || '',
  }

  mem.lastUserAnswer = lastUserText.slice(0, 200)
  mem.lastActionSummary = getActionSummary(
    lastChangeEvent?.type || lastChangeEvent?.kind,
    lastChangeEvent?.payload || lastChangeEvent?.details,
    nodes,
    edges
  )

  if (lastUserText && !['[Ready to start]', '[Starting interview]'].includes(lastUserText)) {
    mem = updateUserSkill(mem, lastUserText)
  }

  const lastAskedQuestions = sessionState.lastAskedQuestions || mem.lastAskedQuestions || []
  mem.lastAskedQuestions = lastAskedQuestions.slice(-LAST_ASKED_COUNT)

  const wrong = lastUserText && detectWrong(lastUserText)
  if (wrong) {
    Object.assign(sessionState, toPersistable(mem))
    sessionState.lastAskedQuestions = mem.lastAskedQuestions
    return validateTurnOutput({ interviewerMessage: wrong, intent: 'challenge', target: {}, evaluation: { answerQuality: 2, issues: ['Incorrect'], missing: [] }, nextActions: [] })
  }

  const intent = classifyUserIntent(lastUserText)

  if (intent === 'OFFTOPIC') {
    Object.assign(sessionState, toPersistable(mem))
    return validateTurnOutput({
      interviewerMessage: "Let's stay focused on the system design. What component did you add or change, and why?",
      intent: 'clarify',
      target: {},
      evaluation: { answerQuality: 2, issues: ['Off-topic'], missing: [] },
      nextActions: [],
    })
  }

  if (intent === 'COACH') {
    const coachIdx = mem.coachFollowUpIndex ?? 0
    const msg = getCoachResponse(context, coachIdx)
    mem.coachFollowUpIndex = coachIdx + 1
    mem.mode = 'COACH'
    Object.assign(sessionState, toPersistable(mem))
    sessionState.lastAskedQuestions = mem.lastAskedQuestions
    sessionState.coachFollowUpIndex = mem.coachFollowUpIndex
    return validateTurnOutput({
      interviewerMessage: msg,
      intent: 'clarify',
      target: {},
      evaluation: { answerQuality: 3, issues: [], missing: [] },
      nextActions: [],
    })
  }

  if (intent === 'CLARIFY') {
    const msg = getClarifyResponse(context)
    Object.assign(sessionState, toPersistable(mem))
    sessionState.lastAskedQuestions = mem.lastAskedQuestions
    return validateTurnOutput({
      interviewerMessage: msg,
      intent: 'clarify',
      target: {},
      evaluation: { answerQuality: 3, issues: [], missing: [] },
      nextActions: [],
    })
  }

  if (intent === 'EVALUATE') {
    const msg = getEvaluateResponse(context, lastUserText)
    Object.assign(sessionState, toPersistable(mem))
    sessionState.lastAskedQuestions = mem.lastAskedQuestions
    return validateTurnOutput({
      interviewerMessage: msg,
      intent: 'drill_down',
      target: {},
      evaluation: { answerQuality: 4, issues: [], missing: [] },
      nextActions: [],
    })
  }

  const changeType = lastChangeEvent?.type || lastChangeEvent?.kind
  const payload = lastChangeEvent?.payload || lastChangeEvent?.details

  if (changeType === 'move' || (changeType && !payload && !lastUserText)) {
    Object.assign(sessionState, toPersistable(mem))
    return validateTurnOutput({
      interviewerMessage: "That change doesn't alter the design—why did you do it?",
      intent: 'challenge',
      target: {},
      evaluation: { answerQuality: 2, issues: ['No meaningful change'], missing: [] },
      nextActions: [],
    })
  }

  // No-op: already asked to justify once?
  if (sessionState.noOpJustifyAttempts >= 1 && lastUserText) {
    const isNoOp = detectNoOp(changeType, payload, nodes, edges)
    if (isNoOp) {
      mem.noOpJustifyAttempts = 1
      Object.assign(sessionState, toPersistable(mem))
      return validateTurnOutput({
        interviewerMessage: "Consider removing it and adding a component that clearly addresses latency, availability, or scalability. What would you add instead?",
        intent: 'challenge',
        target: {},
        evaluation: { answerQuality: 2, issues: ['Unnecessary component'], missing: [] },
        nextActions: [],
      })
    }
  }

  if (lastTurns.length === 0 || ['[Ready to start]', '[Starting interview]'].includes(lastUserText)) {
    mem.lastTopics = [...mem.lastTopics, 'requirements'].slice(-5)
    Object.assign(sessionState, toPersistable(mem))
    sessionState.coveredSections = sessionState.coveredSections || {}
    sessionState.coveredSections.requirements = true
    sessionState.askedQuestionHashes = mem.askedHashes
    sessionState.difficulty = mem.difficulty
    sessionState.userSkill = mem.userSkill
    sessionState.lastTopicTags = mem.lastTopics
    sessionState.lastUserAnswerSummary = mem.lastUserAnswer
    return validateTurnOutput({
      interviewerMessage: SECTION_OPENERS.requirements,
      intent: 'clarify',
      target: { requirementTags: ['requirements'] },
      evaluation: { answerQuality: 3, issues: [], missing: [] },
      nextActions: [],
    })
  }

  // Diagram change: addNode, etc.
  if ((changeType === 'addNode' || changeType === 'connect') && (payload || lastUserText)) {
    const isNoOp = changeType === 'addNode' && detectNoOp(changeType, payload, nodes, edges)
    if (isNoOp) mem.noOpJustifyAttempts = (mem.noOpJustifyAttempts || 0) + 1

    const { composed, hash, mainLine } = pickNextQuestion(context, mem)
    mem = recordQuestion(mem, composed.main, (getTopicsForAction(changeType, payload)[0] || 'default'))
    mem.lastAskedQuestions = [...(mem.lastAskedQuestions || []), (mainLine || composed.main?.split('.')[0]?.trim() || '')].filter(Boolean).slice(-LAST_ASKED_COUNT)

    Object.assign(sessionState, toPersistable(mem))
    sessionState.askedQuestionHashes = mem.askedHashes
    sessionState.difficulty = mem.difficulty
    sessionState.userSkill = mem.userSkill
    sessionState.lastTopicTags = mem.lastTopics
    sessionState.lastUserAnswerSummary = mem.lastUserAnswer
    sessionState.lastAskedQuestions = mem.lastAskedQuestions

    const componentTags = payload ? [getTopicFromPayload(payload)] : []
    return validateTurnOutput({
      interviewerMessage: formatQuestion(composed),
      intent: isNoOp ? 'challenge' : 'drill_down',
      target: { nodeIds: payload?.id ? [payload.id] : [], requirementTags: componentTags },
      evaluation: { answerQuality: mem.userSkill + 2, issues: [], missing: [] },
      nextActions: [],
    })
  }

  const quality = lastUserText.length >= 30 && /\d|qps|ttl|partition|cache|replica|consistency|availability/i.test(lastUserText) ? 4 : 3
  const componentTopics = ['cache', 'queue', 'shard', 'lb', 'database', 'sharding', 'caching']
  const wasDrilling = mem.lastTopics.some((t) => componentTopics.includes(String(t).toLowerCase()))
  if (quality >= 4 && !wasDrilling) {
    sessionState.coveredSections = sessionState.coveredSections || {}
    const next = SECTIONS.find((s) => !sessionState.coveredSections[s]) || 'wrap_up'
    sessionState.coveredSections[next] = true
    mem.lastTopics = [...mem.lastTopics, next].slice(-5)
    Object.assign(sessionState, toPersistable(mem))
    sessionState.askedQuestionHashes = mem.askedHashes
    sessionState.difficulty = mem.difficulty
    sessionState.userSkill = mem.userSkill
    sessionState.lastTopicTags = mem.lastTopics
    sessionState.lastUserAnswerSummary = mem.lastUserAnswer
    return validateTurnOutput({
      interviewerMessage: SECTION_OPENERS[next],
      intent: 'next_topic',
      target: { requirementTags: [next] },
      evaluation: { answerQuality: quality, issues: [], missing: [] },
      nextActions: [],
    })
  }

  const { composed, hash, mainLine } = pickNextQuestion(context, mem)
  mem = recordQuestion(mem, composed.main, 'default')
  mem.lastAskedQuestions = [...(mem.lastAskedQuestions || []), (mainLine || composed.main?.split('.')[0]?.trim() || '')].filter(Boolean).slice(-LAST_ASKED_COUNT)
  Object.assign(sessionState, toPersistable(mem))
  sessionState.askedQuestionHashes = mem.askedHashes
  sessionState.difficulty = mem.difficulty
  sessionState.userSkill = mem.userSkill
  sessionState.lastTopicTags = mem.lastTopics
  sessionState.lastUserAnswerSummary = mem.lastUserAnswer
  sessionState.lastAskedQuestions = mem.lastAskedQuestions

  return validateTurnOutput({
    interviewerMessage: formatQuestion(composed),
    intent: 'drill_down',
    target: { nodeIds: payload?.id ? [payload.id] : [], requirementTags: [] },
    evaluation: { answerQuality: quality, issues: [], missing: [] },
    nextActions: [],
  })
}

export async function processTurn(input, sessionState = {}) {
  const normalized = validateTurnInput(input)
  const { isConfigured } = await import('../runtime/llamaRuntime.js').then((m) => ({ isConfigured: m.isConfigured })).catch(() => ({ isConfigured: false }))

  if (isConfigured && isConfigured()) {
    const prompt = `You are an elite system design interviewer. Output ONLY valid JSON: { interviewerMessage, intent, target:{nodeIds:[],requirementTags:[]}, evaluation:{answerQuality:1-5,issues:[],missing:[]} }`
    const llamaOut = await generate(prompt, JSON.stringify(normalized))
    if (llamaOut) {
      try {
        const m = llamaOut.match(/\{[\s\S]*\}/)
        if (m) {
          const parsed = JSON.parse(m[0])
          if (parsed.interviewerMessage) return validateTurnOutput(parsed)
        }
      } catch (e) { /* fall through */ }
    }
  }

  return heuristicTurn(normalized, sessionState)
}

export async function getNextAction(packOrId, phase, userAnswer, currentGraph, lastDiff, lastAskedQuestion) {
  const pack = typeof packOrId === 'object' ? packOrId : { id: packOrId }
  const lastTurns = []
  if (lastAskedQuestion) lastTurns.push({ role: 'interviewer', text: lastAskedQuestion })
  if (userAnswer) lastTurns.push({ role: 'user', text: userAnswer })
  let lastChangeEvent = null
  const addedNodes = lastDiff?.addedNodes || []
  const addedEdges = lastDiff?.addedEdges || []
  if (addedNodes.length) lastChangeEvent = { type: 'addNode', payload: addedNodes[0] }
  else if (addedEdges.length) lastChangeEvent = { type: 'connect', payload: addedEdges[0] }
  const input = validateTurnInput({
    questionPackSummary: pack,
    diagramSnapshot: currentGraph,
    lastChangeEvent,
    trafficLoad: 1000,
    transcript: { lastTurns },
  })
  const out = await processTurn(input, {})
  return { action: out.intent, question: out.interviewerMessage, questionText: out.interviewerMessage, ...out }
}

export function appendToMemory(chunk) {
  appendInterviewerMemory(chunk)
}
