/**
 * Simple JSON file persistence for questions, baselines, and drafts.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORE_PATH = path.join(__dirname, 'data', 'store.json')
const LEGACY_QUESTIONS_PATH = path.join(__dirname, 'data', 'questions.json')

const DEFAULT_STORE = {
  questions: [],
  baselines: {},
  drafts: {},
  interviewSessions: {},
}

// Designs are in-memory only; never persisted. Server restart = empty designs.
let designsInMemory = {}

/**
 * Read store from disk. Returns default structure if file missing.
 * Note: designs are NOT read from disk; they live in memory only.
 */
export function readStore() {
  try {
    let store
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, 'utf-8')
      const parsed = JSON.parse(data)
      store = {
        questions: Array.isArray(parsed.questions) ? parsed.questions : [],
        baselines: parsed.baselines && typeof parsed.baselines === 'object' ? parsed.baselines : {},
        drafts: parsed.drafts && typeof parsed.drafts === 'object' ? parsed.drafts : {},
        interviewSessions: parsed.interviewSessions && typeof parsed.interviewSessions === 'object' ? parsed.interviewSessions : {},
      }
    } else {
      store = { ...JSON.parse(JSON.stringify(DEFAULT_STORE)) }
      if (fs.existsSync(LEGACY_QUESTIONS_PATH)) {
        const legacy = JSON.parse(fs.readFileSync(LEGACY_QUESTIONS_PATH, 'utf-8'))
        const arr = Array.isArray(legacy) ? legacy : (legacy.questions || legacy || [])
        store.questions = arr.map((q) => ({
          id: q.id,
          title: q.title,
          rawText: q.rawSectionText ?? q.rawText,
          summary: q.shortDescription ?? q.summary,
          functional: q.functionalRequirements ?? q.functional ?? [],
          nonFunctional: q.nonFunctionalRequirements ?? q.nonFunctional ?? [],
        }))
        writeStore(store)
      }
    }
    return store
  } catch (err) {
    console.warn('readStore failed, using default:', err?.message)
    return { ...JSON.parse(JSON.stringify(DEFAULT_STORE)) }
  }
}

/**
 * Write store to disk.
 */
export function writeStore(store) {
  try {
    const dir = path.dirname(STORE_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8')
  } catch (err) {
    console.error('writeStore error:', err)
    throw err
  }
}

/**
 * Ensure store exists. Call on server start.
 */
export function safeInitStore() {
  const store = readStore()
  writeStore(store)
}

/**
 * Interview session persistence.
 */
export function getInterviewSession(sessionId) {
  const store = readStore()
  return (store.interviewSessions || {})[sessionId] || null
}

export function upsertInterviewSession(session) {
  const store = readStore()
  store.interviewSessions = store.interviewSessions || {}
  const sid = session.sessionId || `interview-${session.currentPackId}`
  store.interviewSessions[sid] = { ...session, sessionId: sid }
  writeStore(store)
  return store.interviewSessions[sid]
}

export function listInterviewSessions() {
  const store = readStore()
  return Object.values(store.interviewSessions || {})
}

export function deleteInterviewSession(sessionId) {
  const store = readStore()
  store.interviewSessions = store.interviewSessions || {}
  delete store.interviewSessions[sessionId]
  writeStore(store)
}

// ---- Design state (keyed by designId) ----
// Designs live in memory only; never persisted. Server restart = empty designs.
const EMPTY_DESIGN = {
  nodes: [],
  edges: [],
  requirements: {},
  interview: { messages: [], selectedQuestion: null },
  packId: null,
  selectedQuestionId: null,
  requirementsProgress: {},
  notes: {},
  trafficLoad: 1000,
  createdAt: null,
}

export function getOrCreateDesignState(designId) {
  if (!designsInMemory[designId]) {
    designsInMemory[designId] = {
      ...EMPTY_DESIGN,
      createdAt: new Date().toISOString(),
    }
  }
  return designsInMemory[designId]
}

export function resetDesignState(designId) {
  designsInMemory[designId] = {
    ...EMPTY_DESIGN,
    createdAt: new Date().toISOString(),
  }
  return designsInMemory[designId]
}

export function getDesignState(designId) {
  return designsInMemory[designId] || null
}

export function updateDesignState(designId, updates) {
  const current = designsInMemory[designId] || { ...EMPTY_DESIGN, createdAt: new Date().toISOString() }
  designsInMemory[designId] = { ...current, ...updates }
  return designsInMemory[designId]
}
