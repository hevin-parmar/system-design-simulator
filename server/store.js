/**
 * Simple JSON file persistence for questions, baselines, and drafts.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORE_PATH = path.join(__dirname, 'data', 'store.json')
const DESIGNS_PATH = path.join(__dirname, 'data', 'designs.json')
const LEGACY_QUESTIONS_PATH = path.join(__dirname, 'data', 'questions.json')

const DEFAULT_STORE = {
  questions: [],
  baselines: {},
  drafts: {},
  interviewSessions: {},
}

let designsInMemory = {}

function loadDesignsFromDisk() {
  try {
    if (fs.existsSync(DESIGNS_PATH)) {
      const raw = fs.readFileSync(DESIGNS_PATH, 'utf-8')
      const data = JSON.parse(raw)
      if (data && typeof data === 'object') return data
    }
  } catch (err) {
    console.warn('loadDesigns failed:', err?.message)
  }
  return {}
}

function saveDesignsToDisk() {
  try {
    const dir = path.dirname(DESIGNS_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(DESIGNS_PATH, JSON.stringify(designsInMemory, null, 2), 'utf-8')
  } catch (err) {
    console.warn('saveDesigns failed:', err?.message)
  }
}

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
  designsInMemory = loadDesignsFromDisk()
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
      ...JSON.parse(JSON.stringify(EMPTY_DESIGN)),
      createdAt: new Date().toISOString(),
    }
    saveDesignsToDisk()
  }
  return designsInMemory[designId]
}

export function resetDesignState(designId) {
  designsInMemory[designId] = {
    ...JSON.parse(JSON.stringify(EMPTY_DESIGN)),
    createdAt: new Date().toISOString(),
  }
  saveDesignsToDisk()
  return designsInMemory[designId]
}

export function getDesignState(designId) {
  return designsInMemory[designId] || null
}

export function updateDesignState(designId, updates) {
  const current = designsInMemory[designId] || { ...JSON.parse(JSON.stringify(EMPTY_DESIGN)), createdAt: new Date().toISOString() }
  designsInMemory[designId] = { ...current, ...updates }
  saveDesignsToDisk()
  return designsInMemory[designId]
}
