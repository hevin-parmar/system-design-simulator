/**
 * Offline persistence layer.
 * Data survives server restart.
 * - /data/packs.json (question packs library)
 * - /data/packs/*.json (individual pack files, take precedence)
 * - /data/sessions.json (interview sessions)
 * - /data/creator/* (creator memory)
 * - /data/interviewer/* (interviewer memory)
 */

/** Bump when pack format changes; stale packs get regenerated. */
export const PACK_VERSION = 2

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../data')
const PACKS_DIR = path.join(DATA_DIR, 'packs')
const PACKS_PATH = path.join(DATA_DIR, 'packs.json')
const SESSIONS_PATH = path.join(DATA_DIR, 'sessions.json')
const CREATOR_DIR = path.join(DATA_DIR, 'creator')
const INTERVIEWER_DIR = path.join(DATA_DIR, 'interviewer')

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function readJson(path, defaultValue) {
  try {
    if (!fs.existsSync(path)) return defaultValue
    return JSON.parse(fs.readFileSync(path, 'utf-8'))
  } catch (err) {
    console.warn(`storage read ${path}:`, err?.message)
    return defaultValue
  }
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

// ---- Packs ----
function loadStarterPacks() {
  if (!fs.existsSync(PACKS_DIR)) return []
  const files = fs.readdirSync(PACKS_DIR).filter((f) => f.endsWith('.json'))
  const packs = []
  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(PACKS_DIR, f), 'utf-8')
      const p = JSON.parse(raw)
      if (p && p.id) packs.push(p)
    } catch (e) {
      console.warn(`storage: skip invalid pack ${f}:`, e?.message)
    }
  }
  return packs
}

export function readPacks() {
  const starter = loadStarterPacks()
  const data = readJson(PACKS_PATH, { packs: [] })
  const userPacks = Array.isArray(data.packs) ? data.packs : []
  const seen = new Set(starter.map((p) => (p.id || '').toLowerCase()))
  for (const p of userPacks) {
    const id = (p.id || '').toLowerCase()
    if (!seen.has(id)) {
      seen.add(id)
      starter.push(p)
    }
  }
  return starter
}

export function writePacks(packs) {
  ensureDir(DATA_DIR)
  writeJson(PACKS_PATH, { packs })
}

export function getPack(id) {
  const packs = readPacks()
  return packs.find((p) => (p.id || '').toLowerCase() === (id || '').toLowerCase())
}

export function savePack(pack) {
  const toSave = { ...pack, packVersion: PACK_VERSION }
  const packs = readPacks()
  const idx = packs.findIndex((p) => (p.id || '').toLowerCase() === (toSave.id || '').toLowerCase())
  if (idx >= 0) packs[idx] = toSave
  else packs.push(toSave)
  writePacks(packs)
  return toSave
}

/** True if pack lacks packVersion or version is lower than PACK_VERSION. */
export function isPackStale(pack) {
  const v = pack?.packVersion
  if (v == null || v === undefined) return true
  return Number(v) < PACK_VERSION
}

/** Write pack to packs/<id>.json. Used by regeneration. */
export function writePackToDir(pack) {
  ensureDir(PACKS_DIR)
  const id = pack.id || `pack-${Date.now()}`
  const file = path.join(PACKS_DIR, `${id}.json`)
  const toWrite = { ...pack, id, packVersion: PACK_VERSION }
  writeJson(file, toWrite)
  return toWrite
}

// ---- Sessions ----
export function readSessions() {
  const data = readJson(SESSIONS_PATH, { sessions: {} })
  return data.sessions && typeof data.sessions === 'object' ? data.sessions : {}
}

export function writeSessions(sessions) {
  ensureDir(DATA_DIR)
  writeJson(SESSIONS_PATH, { sessions })
}

export function getSession(packId) {
  const sessions = readSessions()
  return sessions[packId] || null
}

export function saveSession(packId, session) {
  const sessions = { ...readSessions() }
  sessions[packId] = session
  writeSessions(sessions)
}

// ---- Agent memory (JSONL) ----
export function appendCreatorMemory(chunk) {
  ensureDir(CREATOR_DIR)
  const file = path.join(CREATOR_DIR, 'memory.jsonl')
  fs.appendFileSync(file, JSON.stringify({ ts: Date.now(), text: chunk }) + '\n')
}

export function appendInterviewerMemory(chunk) {
  ensureDir(INTERVIEWER_DIR)
  const file = path.join(INTERVIEWER_DIR, 'memory.jsonl')
  fs.appendFileSync(file, JSON.stringify({ ts: Date.now(), text: chunk }) + '\n')
}

export { CREATOR_DIR, INTERVIEWER_DIR, DATA_DIR, PACKS_DIR }
