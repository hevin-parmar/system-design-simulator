/**
 * Local corpus retrieval by keyword overlap.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHUNKS_PATH = path.join(__dirname, '../corpus/chunks.json')

let chunksCache = null

function loadChunks() {
  if (chunksCache) return chunksCache
  if (!fs.existsSync(CHUNKS_PATH)) return []
  chunksCache = JSON.parse(fs.readFileSync(CHUNKS_PATH, 'utf-8'))
  return chunksCache
}

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Search corpus by keyword overlap. Returns top 3 chunks.
 * @param {string} query
 * @returns {Array<{id, docId, text, score}>}
 */
export function searchKnowledge(query) {
  const chunks = loadChunks()
  const qTokens = new Set(tokenize(query))
  if (qTokens.size === 0) return []

  const scored = chunks.map((chunk) => {
    const tokens = new Set(chunk.tokens || [])
    let score = 0
    for (const t of qTokens) {
      if (tokens.has(t)) score++
    }
    return { ...chunk, score }
  })

  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}
