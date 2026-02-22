/**
 * Interview session: stateful game loop for diagram edits + interviewer Q&A.
 * Uses InterviewerAgent (heuristic stub when LLM not configured).
 */
import crypto from 'crypto'
import { getPack } from '../storage/index.js'
import { getInterviewSession, upsertInterviewSession } from '../store.js'
import { processTurn } from './agents/InterviewerAgent.js'

function diagramHash(nodes, edges) {
  const n = (nodes || []).map((x) => ({
    id: x.id,
    type: x.type || 'default',
    label: (x.data?.label || '').trim(),
  })).sort((a, b) => (a.id || '').localeCompare(b.id || ''))
  const e = (edges || []).map((x) => `${x.source}->${x.target}`).sort()
  const str = JSON.stringify({ n, e })
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16)
}

function isMeaningfulChange(changeMeta) {
  const k = changeMeta?.kind || ''
  return ['addNode', 'deleteNode', 'connect', 'deleteEdge', 'editNode'].includes(k)
}

function isUnnecessaryChange(newHash, lastHash, changeMeta) {
  if (newHash === lastHash) return true
  const k = changeMeta?.kind || ''
  if (k === 'move') return true
  return false
}

/**
 * Ensure a session exists for packId. Returns session (existing or new).
 */
export function ensureSession(sessionId, packId) {
  const sid = sessionId || `interview-${packId}`
  let session = getInterviewSession(sid)
  if (!session) {
    session = {
      sessionId: sid,
      currentPackId: packId,
      history: [],
      askedTopics: [],
      skillEstimate: 0,
      mode: 'ASK',
      lastQuestionId: '',
      lastDiagramHash: null,
      lastMeaningfulChangeTs: null,
      lastChangeEvent: null,
      pendingQuestion: false,
      coveredSections: {},
      askedComponentQuestions: {},
      askedHashes: [],
      askedQuestionHashes: [],
      lastTopics: [],
      lastTopicTags: [],
      difficulty: 1,
      userSkill: 0,
      lastUserAnswer: '',
      lastUserAnswerSummary: '',
      lastActionSummary: '',
      lastQuestionHash: '',
      noOpJustifyAttempts: 0,
      lastAskedQuestions: [],
      coachFollowUpIndex: 0,
      lastFocus: null,
    }
    upsertInterviewSession(session)
  } else if (packId && session.currentPackId !== packId) {
    session.currentPackId = packId
    upsertInterviewSession(session)
  }
  return session
}

/**
 * On diagram change: detect meaningful vs unnecessary, optionally ask interviewer.
 * @returns {{ interviewerMessage?: string, history, unnecessary?: boolean } | null}
 */
export async function onDiagramChanged(sessionId, packId, diagramSnapshot, changeMeta) {
  const session = ensureSession(sessionId, packId)
  const { nodes = [], edges = [] } = diagramSnapshot || {}
  const hash = diagramHash(nodes, edges)

  if (isUnnecessaryChange(hash, session.lastDiagramHash, changeMeta)) {
    const hist = [...(session.history || []), { role: 'interviewer', text: "That change doesn't alter the design—why did you do it?", ts: Date.now(), focus: 'no-op change' }]
    session.history = hist
    session.lastDiagramHash = hash
    upsertInterviewSession(session)
    return { interviewerMessage: "That change doesn't alter the design—why did you do it?", history: hist, focus: 'no-op change', unnecessary: true }
  }

  if (!isMeaningfulChange(changeMeta)) {
    return { history: session.history || [] }
  }

  session.lastDiagramHash = hash
  session.lastMeaningfulChangeTs = Date.now()
  session.pendingQuestion = true

  const pack = getPack(packId) || { id: packId }
  const lastTurns = (session.history || []).slice(-10).map((h) => ({ role: h.role, text: h.text }))
  const lastChangeEvent = {
    type: changeMeta?.kind || 'unknown',
    kind: changeMeta?.kind,
    payload: changeMeta?.details || changeMeta,
  }
  const turnInput = {
    questionPackSummary: {
      title: pack.title,
      problemStatement: pack.problemStatement,
      functionalRequirements: pack.functionalRequirements || [],
      nonFunctionalRequirements: pack.nonFunctionalRequirements || [],
    },
    diagramSnapshot: { nodes, edges, selectedNodeIds: [], highlightedIssues: [] },
    lastChangeEvent,
    trafficLoad: 1000,
    transcript: { lastTurns },
  }
  const sessionState = {
    coveredSections: session.coveredSections || {},
    askedComponentQuestions: session.askedComponentQuestions || {},
    askedHashes: session.askedHashes || session.askedQuestionHashes || [],
    askedQuestionHashes: session.askedQuestionHashes || session.askedHashes || [],
    askedTopics: session.askedTopics || [],
    lastTopics: session.lastTopics || session.lastTopicTags || [],
    lastTopicTags: session.lastTopicTags || session.lastTopics || [],
    lastQuestionId: session.lastQuestionId ?? session.lastQuestionHash ?? '',
    difficulty: session.difficulty ?? 1,
    userSkill: session.userSkill ?? 0,
    skillEstimate: session.skillEstimate ?? session.userSkill ?? 0,
    mode: session.mode ?? 'ASK',
    lastUserAnswer: session.lastUserAnswer ?? '',
    lastUserAnswerSummary: session.lastUserAnswerSummary ?? session.lastUserAnswer ?? '',
    lastActionSummary: session.lastActionSummary ?? '',
    lastQuestionHash: session.lastQuestionHash ?? '',
    noOpJustifyAttempts: session.noOpJustifyAttempts ?? 0,
    lastAskedQuestions: session.lastAskedQuestions || [],
    coachFollowUpIndex: session.coachFollowUpIndex ?? 0,
    lastChangeEvent,
  }
  const out = await processTurn(turnInput, sessionState)
  session.coveredSections = sessionState.coveredSections
  session.askedComponentQuestions = sessionState.askedComponentQuestions
  session.askedHashes = sessionState.askedQuestionHashes || sessionState.askedHashes
  session.askedQuestionHashes = sessionState.askedQuestionHashes || sessionState.askedHashes
  session.askedTopics = sessionState.askedTopics || []
  session.lastQuestionId = sessionState.lastQuestionId ?? sessionState.lastQuestionHash ?? ''
  session.skillEstimate = sessionState.skillEstimate ?? sessionState.userSkill ?? 0
  session.mode = sessionState.mode ?? 'ASK'
  session.lastTopics = sessionState.lastTopicTags || sessionState.lastTopics
  session.lastTopicTags = sessionState.lastTopicTags || sessionState.lastTopics
  session.difficulty = sessionState.difficulty
  session.userSkill = sessionState.userSkill
  session.lastUserAnswer = sessionState.lastUserAnswer
  session.lastUserAnswerSummary = sessionState.lastUserAnswerSummary
  session.lastActionSummary = sessionState.lastActionSummary
  session.lastQuestionHash = sessionState.lastQuestionHash
  session.noOpJustifyAttempts = sessionState.noOpJustifyAttempts
  session.lastAskedQuestions = sessionState.lastAskedQuestions || []
  session.coachFollowUpIndex = sessionState.coachFollowUpIndex ?? 0
  session.lastChangeEvent = lastChangeEvent
  const msg = out.interviewerMessage || 'What drove this change?'
  const focus = [...(out.target?.requirementTags || []), ...(out.target?.nodeIds || []).map((id) => `node:${id}`)].join(', ') || null
  session.lastFocus = focus
  const hist = [...(session.history || []), { role: 'interviewer', text: msg, ts: Date.now(), focus }]
  session.history = hist
  session.pendingQuestion = false
  upsertInterviewSession(session)
  return { interviewerMessage: msg, history: hist, focus }
}

/**
 * On user answer: get next interviewer question.
 * @param {object} opts - { sessionId, packId, text, diagramSnapshot?, trafficLoad? }
 * @returns {{ interviewerMessage, history, focus? }}
 */
export async function onUserAnswer(sessionId, packId, userText, opts = {}) {
  const session = ensureSession(sessionId, packId)
  const hist = [...(session.history || []), { role: 'user', text: userText, ts: Date.now() }]
  session.history = hist

  const pack = getPack(packId) || { id: packId }
  const diagramSnapshot = opts.diagramSnapshot || { nodes: [], edges: [] }
  const trafficLoad = opts.trafficLoad ?? 1000
  const lastTurns = hist.slice(-10).map((h) => ({ role: h.role, text: h.text }))

  const diagramChangeContext = {
    lastChangeEvent: session.lastChangeEvent,
    trafficLoad,
    recentHistory: lastTurns.slice(-6),
  }
  const turnInput = {
    questionPackSummary: {
      title: pack.title,
      problemStatement: pack.problemStatement,
      functionalRequirements: pack.functionalRequirements || [],
      nonFunctionalRequirements: pack.nonFunctionalRequirements || [],
    },
    diagramSnapshot: {
      nodes: diagramSnapshot.nodes || [],
      edges: diagramSnapshot.edges || [],
      selectedNodeIds: diagramSnapshot.selectedNodeIds || [],
      highlightedIssues: diagramSnapshot.highlightedIssues || [],
    },
    lastChangeEvent: session.lastChangeEvent,
    diagramChangeContext,
    trafficLoad,
    transcript: { lastTurns },
  }
  const sessionState = {
    coveredSections: session.coveredSections || {},
    askedComponentQuestions: session.askedComponentQuestions || {},
    askedHashes: session.askedHashes || session.askedQuestionHashes || [],
    askedQuestionHashes: session.askedQuestionHashes || session.askedHashes || [],
    askedTopics: session.askedTopics || [],
    lastTopics: session.lastTopics || session.lastTopicTags || [],
    lastTopicTags: session.lastTopicTags || session.lastTopics || [],
    lastQuestionId: session.lastQuestionId ?? session.lastQuestionHash ?? '',
    difficulty: session.difficulty ?? 1,
    userSkill: session.userSkill ?? 0,
    skillEstimate: session.skillEstimate ?? session.userSkill ?? 0,
    mode: session.mode ?? 'ASK',
    lastUserAnswer: session.lastUserAnswer ?? '',
    lastUserAnswerSummary: session.lastUserAnswerSummary ?? session.lastUserAnswer ?? '',
    lastActionSummary: session.lastActionSummary ?? '',
    lastQuestionHash: session.lastQuestionHash ?? '',
    noOpJustifyAttempts: session.noOpJustifyAttempts ?? 0,
    lastAskedQuestions: session.lastAskedQuestions || [],
    coachFollowUpIndex: session.coachFollowUpIndex ?? 0,
  }
  const out = await processTurn(turnInput, sessionState)
  session.coveredSections = sessionState.coveredSections
  session.askedComponentQuestions = sessionState.askedComponentQuestions
  session.askedHashes = sessionState.askedQuestionHashes || sessionState.askedHashes
  session.askedQuestionHashes = sessionState.askedQuestionHashes || sessionState.askedHashes
  session.askedTopics = sessionState.askedTopics || []
  session.lastQuestionId = sessionState.lastQuestionId ?? sessionState.lastQuestionHash ?? ''
  session.skillEstimate = sessionState.skillEstimate ?? sessionState.userSkill ?? 0
  session.mode = sessionState.mode ?? 'ASK'
  session.lastTopics = sessionState.lastTopicTags || sessionState.lastTopics
  session.lastTopicTags = sessionState.lastTopicTags || sessionState.lastTopics
  session.difficulty = sessionState.difficulty
  session.userSkill = sessionState.userSkill
  session.lastUserAnswer = sessionState.lastUserAnswer
  session.lastUserAnswerSummary = sessionState.lastUserAnswerSummary
  session.lastActionSummary = sessionState.lastActionSummary
  session.lastQuestionHash = sessionState.lastQuestionHash
  session.noOpJustifyAttempts = sessionState.noOpJustifyAttempts
  session.lastAskedQuestions = sessionState.lastAskedQuestions || []
  session.coachFollowUpIndex = sessionState.coachFollowUpIndex ?? 0
  const msg = out.interviewerMessage || 'Anything else you’d like to clarify?'
  const focus = [...(out.target?.requirementTags || []), ...(out.target?.nodeIds || []).map((id) => `node:${id}`)].join(', ') || null
  session.lastFocus = focus
  const nextHist = [...hist, { role: 'interviewer', text: msg, ts: Date.now(), focus }]
  session.history = nextHist
  upsertInterviewSession(session)
  return { interviewerMessage: msg, history: nextHist, focus }
}
